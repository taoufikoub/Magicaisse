import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  cashSessions,
  saleItems,
  sales,
  stockMovements,
  users,
  variants,
} from "../db/schema.ts";
import { AuthRequest, requireAuth } from "../middleware/auth.ts";
import { queueStockSync } from "../lib/shopify.ts";

const router = Router();

// --- CASH SESSION MANAGEMENT ---

// Get currently active cash session for current staff
router.get("/cash-sessions/active", requireAuth, async (req: AuthRequest, res) => {
  try {
    const firebaseUser = req.user!;
    const staff = await db
      .select()
      .from(users)
      .where(eq(users.uid, firebaseUser.uid))
      .limit(1);

    if (staff.length === 0) {
      return res.status(404).json({ error: "Staff profile not found." });
    }

    const active = await db
      .select()
      .from(cashSessions)
      .where(
        and(
          eq(cashSessions.staffId, staff[0].id),
          eq(cashSessions.status, "open"),
        ),
      )
      .limit(1);

    if (active.length === 0) {
      return res.json(null);
    }
    res.json(active[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Open a new cash session
router.post("/cash-sessions/open", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { openingCash } = req.body;
    if (openingCash === undefined || isNaN(parseFloat(openingCash))) {
      return res.status(400).json({ error: "Valid opening cash is required" });
    }

    const staff = await db
      .select()
      .from(users)
      .where(eq(users.uid, req.user!.uid))
      .limit(1);

    if (staff.length === 0) {
      return res.status(404).json({ error: "Staff profile not found" });
    }

    // Check if session is already open
    const openSession = await db
      .select()
      .from(cashSessions)
      .where(
        and(
          eq(cashSessions.staffId, staff[0].id),
          eq(cashSessions.status, "open"),
        ),
      );

    if (openSession.length > 0) {
      return res.status(400).json({ error: "A session is already open for this staff member" });
    }

    const created = await db
      .insert(cashSessions)
      .values({
        staffId: staff[0].id,
        status: "open",
        openingCash: String(openingCash),
        openedAt: new Date(),
      })
      .returning();

    res.json(created[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Close an active cash session
router.post("/cash-sessions/:id/close", requireAuth, async (req: AuthRequest, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const { countedCash, cardTotal, refunds, notes } = req.body;

    if (countedCash === undefined || isNaN(parseFloat(countedCash))) {
      return res.status(400).json({ error: "Valid counted cash is required" });
    }

    const sessionList = await db
      .select()
      .from(cashSessions)
      .where(eq(cashSessions.id, sessionId))
      .limit(1);

    if (sessionList.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessionList[0];
    if (session.status === "closed") {
      return res.status(400).json({ error: "Session is already closed" });
    }

    // Calculate expected cash based on sales
    const salesInSession = await db
      .select({
        total: sql<string>`COALESCE(SUM(${sales.totalAmount}), '0.00')`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.sessionId, sessionId),
          eq(sales.paymentMethod, "cash"),
        ),
      );

    const cashSalesSum = parseFloat(salesInSession[0]?.total || "0");
    const opCash = parseFloat(session.openingCash);
    const refundCash = parseFloat(refunds || "0");
    const expected = opCash + cashSalesSum - refundCash;

    const diff = parseFloat(countedCash) - expected;

    const updated = await db
      .update(cashSessions)
      .set({
        status: "closed",
        closedAt: new Date(),
        expectedCash: String(expected.toFixed(2)),
        countedCash: String(parseFloat(countedCash).toFixed(2)),
        difference: String(diff.toFixed(2)),
        cardTotal: String(parseFloat(cardTotal || "0").toFixed(2)),
        refunds: String(refundCash.toFixed(2)),
        notes,
      })
      .where(eq(cashSessions.id, sessionId))
      .returning();

    res.json(updated[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all cash sessions history
router.get("/cash-sessions", requireAuth, async (req, res) => {
  try {
    const list = await db
      .select({
        id: cashSessions.id,
        staffId: cashSessions.staffId,
        staffName: users.name,
        status: cashSessions.status,
        openedAt: cashSessions.openedAt,
        closedAt: cashSessions.closedAt,
        openingCash: cashSessions.openingCash,
        expectedCash: cashSessions.expectedCash,
        countedCash: cashSessions.countedCash,
        difference: cashSessions.difference,
        cardTotal: cashSessions.cardTotal,
        refunds: cashSessions.refunds,
        notes: cashSessions.notes,
      })
      .from(cashSessions)
      .innerJoin(users, eq(cashSessions.staffId, users.id))
      .orderBy(desc(cashSessions.openedAt));

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- POS SALES / CHECKOUT ROUTE ---

// Get sales history list
router.get("/sales", requireAuth, async (req, res) => {
  try {
    const list = await db
      .select()
      .from(sales)
      .orderBy(desc(sales.createdAt));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Complete a POS checkout sale (source of truth stock adjustment!)
router.post("/sales", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { customerId, items, paymentMethod, discountAmount, totalAmount, sessionId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Checkout cart cannot be empty" });
    }

    const staff = await db
      .select()
      .from(users)
      .where(eq(users.uid, req.user!.uid))
      .limit(1);

    if (staff.length === 0) {
      return res.status(404).json({ error: "Staff cashier profile not found" });
    }

    const cashierId = staff[0].id;
    const saleNum = `POS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    // Process sale
    const result = await db.transaction(async (tx) => {
      // 1. Create Sale Header
      const salesHeader = await tx
        .insert(sales)
        .values({
          cashierId,
          customerId: customerId ? parseInt(customerId) : null,
          saleNumber: saleNum,
          sessionId: sessionId ? parseInt(sessionId) : null,
          totalAmount: String(totalAmount),
          discountAmount: String(discountAmount || "0.00"),
          paymentMethod: paymentMethod || "cash",
          createdAt: new Date(),
        })
        .returning();

      const saleRecord = salesHeader[0];

      // 2. Loop Cart Items
      const saleDetails = [];
      for (const item of items) {
        const variantId = parseInt(item.variantId);
        const qty = parseInt(item.quantity);

        // Fetch current variant stock levels
        const variantData = await tx
          .select()
          .from(variants)
          .where(eq(variants.id, variantId))
          .limit(1);

        if (variantData.length === 0) {
          throw new Error(`Variant ID ${variantId} does not exist`);
        }

        const currentVar = variantData[0];
        const previousStock = currentVar.stock;
        const newStock = previousStock - qty;

        // Reduce stock level
        await tx
          .update(variants)
          .set({ stock: newStock })
          .where(eq(variants.id, variantId));

        // Create Sales Item record
        const sItem = await tx
          .insert(saleItems)
          .values({
            saleId: saleRecord.id,
            variantId,
            quantity: qty,
            unitPrice: String(item.unitPrice),
            discount: String(item.discount || "0.00"),
            totalPrice: String(item.totalPrice),
          })
          .returning();

        // Log Stock Movement
        await tx.insert(stockMovements).values({
          variantId,
          type: "sale",
          quantity: -qty,
          previousStock,
          newStock,
          reason: `Physical POS Sale ${saleNum}`,
          userId: cashierId,
          createdAt: new Date(),
        });

        saleDetails.push(sItem[0]);
      }

      return { sale: saleRecord, items: saleDetails };
    });

    // 3. Queue Shopify Sync asynchronously (outside transaction to avoid database lockups!)
    for (const item of items) {
      queueStockSync(parseInt(item.variantId)).catch((e) =>
        console.error(`Failed to queue Shopify stock sync for variant ${item.variantId}:`, e),
      );
    }

    res.json(result);
  } catch (error: any) {
    console.error("Sale transaction failed:", error);
    res.status(500).json({ error: error.message || "Checkout failed to complete" });
  }
});

// --- RETURNS AND EXCHANGES ---

router.post("/sales/:id/return", requireAuth, async (req: AuthRequest, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const { items, refundAmount } = req.body; // items: [{ variantId, quantity, restockOption: 'restock' | 'damaged' }]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Return items list is required" });
    }

    const staff = await db
      .select()
      .from(users)
      .where(eq(users.uid, req.user!.uid))
      .limit(1);

    const cashierId = staff[0]?.id;

    const returnResult = await db.transaction(async (tx) => {
      for (const item of items) {
        const vId = parseInt(item.variantId);
        const qty = parseInt(item.quantity);
        const restockOption = item.restockOption; // 'restock' or 'damaged'

        const vList = await tx.select().from(variants).where(eq(variants.id, vId)).limit(1);
        if (vList.length === 0) continue;

        const currentVar = vList[0];
        const previousStock = currentVar.stock;

        let newStock = previousStock;
        if (restockOption === "restock") {
          newStock = previousStock + qty;
          // Restock variant stock
          await tx.update(variants).set({ stock: newStock }).where(eq(variants.id, vId));
        }

        // Add Stock Movement
        await tx.insert(stockMovements).values({
          variantId: vId,
          type: restockOption === "restock" ? "return" : "damaged",
          quantity: qty,
          previousStock,
          newStock,
          reason: `POS Return from Sale ID #${saleId}. Option: ${restockOption}`,
          userId: cashierId,
        });
      }
      return { success: true };
    });

    // Queue sync for restocked items
    for (const item of items) {
      if (item.restockOption === "restock") {
        queueStockSync(parseInt(item.variantId)).catch((e) =>
          console.error(`Failed to queue Shopify sync for returned variant ${item.variantId}:`, e),
        );
      }
    }

    res.json(returnResult);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
