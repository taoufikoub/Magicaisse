import { Router } from "express";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  purchaseOrderItems,
  purchaseOrders,
  shopifySyncQueue,
  stockMovements,
  suppliers,
  users,
  variants,
} from "../db/schema.ts";
import { queueStockSync, processSyncQueue } from "../lib/shopify.ts";
import { AuthRequest, requireAuth } from "../middleware/auth.ts";

const router = Router();

// --- STOCK LEVEL ADJUSTMENTS & MOVEMENTS ---

// Get historical audit of stock movements
router.get("/movements", requireAuth, async (req, res) => {
  try {
    const list = await db
      .select({
        id: stockMovements.id,
        variantId: stockMovements.variantId,
        sku: variants.sku,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        previousStock: stockMovements.previousStock,
        newStock: stockMovements.newStock,
        reason: stockMovements.reason,
        staffName: users.name,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(variants, eq(stockMovements.variantId, variants.id))
      .leftJoin(users, eq(stockMovements.userId, users.id))
      .orderBy(desc(stockMovements.createdAt));

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Perform manual stock level adjustments (and sync to Shopify!)
router.post("/adjust", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { variantId, adjustmentQty, reason } = req.body;

    if (variantId === undefined || adjustmentQty === undefined) {
      return res.status(400).json({ error: "variantId and adjustmentQty are required" });
    }

    const vId = parseInt(variantId);
    const adjust = parseInt(adjustmentQty);

    const staff = await db
      .select()
      .from(users)
      .where(eq(users.uid, req.user!.uid))
      .limit(1);

    const staffId = staff[0]?.id;

    const result = await db.transaction(async (tx) => {
      const vList = await tx.select().from(variants).where(eq(variants.id, vId)).limit(1);
      if (vList.length === 0) {
        throw new Error("Variant does not exist");
      }

      const v = vList[0];
      const previousStock = v.stock;
      const newStock = previousStock + adjust;

      // Update variant stock
      await tx.update(variants).set({ stock: newStock }).where(eq(variants.id, vId));

      // Record movement
      const movement = await tx
        .insert(stockMovements)
        .values({
          variantId: vId,
          type: "manual_adjustment",
          quantity: adjust,
          previousStock,
          newStock,
          reason: reason || "Manual adjustment",
          userId: staffId,
          createdAt: new Date(),
        })
        .returning();

      return { variant: { ...v, stock: newStock }, movement: movement[0] };
    });

    // Queue stock sync to Shopify brands linked to this variant
    queueStockSync(vId).catch((e) =>
      console.error(`Failed to sync Shopify stock for variant ${vId} after manual adjust:`, e),
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get list of items with stock levels <= low stock limit (alert items)
router.get("/low-stock", requireAuth, async (req, res) => {
  try {
    const lowStockItems = await db
      .select()
      .from(variants)
      .where(lte(variants.stock, 5)) // Alert threshold of 5 units
      .orderBy(variants.stock);

    res.json(lowStockItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- PURCHASE ORDER MANAGEMENT ---

// List all Purchase Orders
router.get("/purchase-orders", requireAuth, async (req, res) => {
  try {
    const list = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        status: purchaseOrders.status,
        totalCost: purchaseOrders.totalCost,
        notes: purchaseOrders.notes,
        createdAt: purchaseOrders.createdAt,
        receivedAt: purchaseOrders.receivedAt,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .orderBy(desc(purchaseOrders.createdAt));

    // For each PO, retrieve nested items
    const poItems = await db.select().from(purchaseOrderItems);

    const result = list.map((po) => {
      const items = poItems.filter((item) => item.purchaseOrderId === po.id);
      return { ...po, items };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a Purchase Order
router.post("/purchase-orders", requireAuth, async (req, res) => {
  try {
    const { supplierId, notes, items } = req.body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Supplier and purchase items are required" });
    }

    const poNum = `PO-${Date.now().toString().slice(-6)}`;

    const result = await db.transaction(async (tx) => {
      let totalCost = 0;
      for (const item of items) {
        totalCost += parseFloat(item.costPrice) * parseInt(item.quantityOrdered);
      }

      const createdPo = await tx
        .insert(purchaseOrders)
        .values({
          poNumber: poNum,
          supplierId: parseInt(supplierId),
          status: "draft",
          totalCost: String(totalCost.toFixed(2)),
          notes,
          createdAt: new Date(),
        })
        .returning();

      const po = createdPo[0];

      const insertedItems = [];
      for (const item of items) {
        const itemRecord = await tx
          .insert(purchaseOrderItems)
          .values({
            purchaseOrderId: po.id,
            variantId: parseInt(item.variantId),
            quantityOrdered: parseInt(item.quantityOrdered),
            quantityReceived: 0,
            costPrice: String(item.costPrice),
          })
          .returning();
        insertedItems.push(itemRecord[0]);
      }

      return { ...po, items: insertedItems };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Receive a Purchase Order (restock items!)
router.post("/purchase-orders/:id/receive", requireAuth, async (req: AuthRequest, res) => {
  try {
    const poId = parseInt(req.params.id);
    const { items } = req.body; // items: [{ variantId, quantityReceived }]

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Received items quantities are required" });
    }

    const staff = await db
      .select()
      .from(users)
      .where(eq(users.uid, req.user!.uid))
      .limit(1);

    const staffId = staff[0]?.id;

    await db.transaction(async (tx) => {
      // Update PO status to received
      await tx
        .update(purchaseOrders)
        .set({
          status: "received",
          receivedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, poId));

      for (const item of items) {
        const vId = parseInt(item.variantId);
        const qtyReceived = parseInt(item.quantityReceived || 0);

        if (qtyReceived <= 0) continue;

        // Update item received quantity
        await tx
          .update(purchaseOrderItems)
          .set({ quantityReceived: qtyReceived })
          .where(
            and(
              eq(purchaseOrderItems.purchaseOrderId, poId),
              eq(purchaseOrderItems.variantId, vId),
            ),
          );

        // Update local variant stock
        const vList = await tx.select().from(variants).where(eq(variants.id, vId)).limit(1);
        if (vList.length === 0) continue;

        const currentVar = vList[0];
        const previousStock = currentVar.stock;
        const newStock = previousStock + qtyReceived;

        await tx.update(variants).set({ stock: newStock }).where(eq(variants.id, vId));

        // Insert stock movement
        await tx.insert(stockMovements).values({
          variantId: vId,
          type: "purchase_order",
          quantity: qtyReceived,
          previousStock,
          newStock,
          reason: `Received Purchase Order ID #${poId}`,
          userId: staffId,
          createdAt: new Date(),
        });
      }
    });

    // Queue stock sync to Shopify brands linked to these variants
    for (const item of items) {
      queueStockSync(parseInt(item.variantId)).catch((e) =>
        console.error(`Failed to sync Shopify stock for variant ${item.variantId} after receiving PO:`, e),
      );
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- SHOPIFY SYNC QUEUE MANAGEMENT ---

// List all Shopify sync queue jobs
router.get("/sync-queue", requireAuth, async (req, res) => {
  try {
    const list = await db
      .select({
        id: shopifySyncQueue.id,
        variantId: shopifySyncQueue.variantId,
        sku: variants.sku,
        brand: shopifySyncQueue.brand,
        actionType: shopifySyncQueue.actionType,
        payload: shopifySyncQueue.payload,
        status: shopifySyncQueue.status,
        attempts: shopifySyncQueue.attempts,
        errorMessage: shopifySyncQueue.errorMessage,
        lastAttempt: shopifySyncQueue.lastAttempt,
        createdAt: shopifySyncQueue.createdAt,
      })
      .from(shopifySyncQueue)
      .innerJoin(variants, eq(shopifySyncQueue.variantId, variants.id))
      .orderBy(desc(shopifySyncQueue.createdAt));

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger to process pending/failed sync tasks
router.post("/sync-queue/retry-all", requireAuth, async (req, res) => {
  try {
    await processSyncQueue();
    res.json({ success: true, message: "Sync worker processed successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sync-queue/:id/retry", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Reset status to pending so worker picks it up
    await db
      .update(shopifySyncQueue)
      .set({
        status: "pending",
        attempts: 0,
        errorMessage: null,
      })
      .where(eq(shopifySyncQueue.id, id));

    // Force run worker immediately
    await processSyncQueue();

    const updated = await db
      .select()
      .from(shopifySyncQueue)
      .where(eq(shopifySyncQueue.id, id))
      .limit(1);

    res.json(updated[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
