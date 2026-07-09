import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  products,
  shopifyConnections,
  shopifyOrderItems,
  shopifyOrders,
  stockMovements,
  variants,
} from "../db/schema.ts";
import { queueStockSync } from "../lib/shopify.ts";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();

// --- WEBHOOK FOR SHOPIFY ORDERS (ORDER CREATED) ---

/**
 * Shopify webhook endpoint when an order is created.
 * Configured in Shopify admin like: https://app.com/api/webhooks/shopify/order-created?brand=magijouets
 */
router.post("/webhooks/order-created", async (req, res) => {
  try {
    const brandQuery = req.query.brand as string;
    const orderData = req.body;

    if (!brandQuery) {
      return res.status(400).json({ error: "Missing brand query parameter." });
    }

    const brand = brandQuery.toLowerCase();
    const orderId = String(orderData.id || orderData.shopify_order_id);
    const orderNum = String(orderData.order_number || orderData.name || `#${orderId}`);

    // Enforce "make shopify only when sycnorise products"
    const lineItems = orderData.line_items || [];
    let hasSyncedItem = false;

    for (const item of lineItems) {
      const shopVariantId = String(item.variant_id);
      const conn = await db
        .select()
        .from(shopifyConnections)
        .where(
          and(
            eq(shopifyConnections.brand, brand),
            eq(shopifyConnections.shopifyVariantId, shopVariantId),
          )
        )
        .limit(1);

      if (conn.length > 0) {
        hasSyncedItem = true;
        break;
      }
    }

    if (!hasSyncedItem) {
      console.log(`[Shopify Webhook] Skipping order ${orderNum} for brand ${brand} - no synchronized items in this order.`);
      return res.json({ status: "skipped_not_synchronized", message: "Ignorée : cette commande ne contient aucun produit synchronisé avec le catalogue." });
    }

    // Idempotency check: verify if order already processed
    const existing = await db
      .select()
      .from(shopifyOrders)
      .where(eq(shopifyOrders.shopifyOrderId, orderId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[Shopify Webhook] Order ${orderNum} for brand ${brand} already imported.`);
      return res.json({ status: "already_processed" });
    }

    // Parse customer details
    const customerName = orderData.customer
      ? `${orderData.customer.first_name || ""} ${orderData.customer.last_name || ""}`.trim()
      : orderData.customer_name || "Guest";
    const customerPhone = orderData.customer?.phone || orderData.customer_phone || "";
    const customerCity = orderData.shipping_address?.city || orderData.customer_city || "";
    const totalPrice = orderData.total_price || "0.00";
    const paymentStatus = orderData.financial_status || "paid";
    const fulfillmentStatus = orderData.fulfillment_status || "unfulfilled";

    // Begin Order Import Transaction
    const result = await db.transaction(async (tx) => {
      // 1. Insert Shopify Order Header
      const createdOrder = await tx
        .insert(shopifyOrders)
        .values({
          shopifyOrderId: orderId,
          orderNumber: orderNum,
          brand: brand,
          customerName,
          customerPhone,
          customerCity,
          totalPrice,
          paymentStatus,
          fulfillmentStatus,
          reservationStatus: "reserved",
          shopifyCreatedAt: orderData.created_at ? new Date(orderData.created_at) : new Date(),
        })
        .returning();

      const orderRecord = createdOrder[0];
      const matchedVariantIds: number[] = [];

      // 2. Process Line Items
      for (const item of lineItems) {
        const itemQty = parseInt(item.quantity || 1);
        const shopVariantId = String(item.variant_id);
        const itemSku = String(item.sku || "");

        // Find the matched local variant
        let localVariantId: number | null = null;

        // Try to match strictly via shopify variant connection
        const matchedConn = await tx
          .select()
          .from(shopifyConnections)
          .where(
            and(
              eq(shopifyConnections.brand, brand),
              eq(shopifyConnections.shopifyVariantId, shopVariantId),
            ),
          )
          .limit(1);

        if (matchedConn.length > 0) {
          localVariantId = matchedConn[0].variantId;
        }

        if (localVariantId) {
          // Fetch current variant stocks
          const vList = await tx
            .select()
            .from(variants)
            .where(eq(variants.id, localVariantId))
            .limit(1);

          if (vList.length > 0) {
            const v = vList[0];
            const previousStock = v.stock;
            const newStock = previousStock - itemQty;
            const newReserved = v.reservedStock + itemQty;

            // Reduce physical stock & increase reservation
            await tx
              .update(variants)
              .set({
                stock: newStock,
                reservedStock: newReserved,
              })
              .where(eq(variants.id, localVariantId));

            // Create Order Item
            await tx.insert(shopifyOrderItems).values({
              shopifyOrderId: orderRecord.id,
              variantId: localVariantId,
              quantity: itemQty,
              shopifyVariantId: shopVariantId,
              price: item.price || "0.00",
            });

            // Log Stock Movement
            await tx.insert(stockMovements).values({
              variantId: localVariantId,
              type: "shopify_order",
              quantity: -itemQty,
              previousStock,
              newStock,
              reason: `Online Shopify Order ${orderNum} [${brand}] (Reserved Stock +${itemQty})`,
            });

            matchedVariantIds.push(localVariantId);
          }
        } else {
          console.warn(`[Shopify Sync] Warning: Could not find local variant match for item ${itemSku} / shopVariantId ${shopVariantId}`);
        }
      }

      return { order: orderRecord, variantsToSync: matchedVariantIds };
    });

    // 3. Queue stock sync to ALL OTHER brands linked to the updated variants (except the originating brand!)
    for (const vId of result.variantsToSync) {
      queueStockSync(vId, brand).catch((e) =>
        console.error(`Failed to sync Shopify stock for variant ${vId} after Shopify order webhook:`, e),
      );
    }

    res.json({ status: "success", orderId: result.order.id });
  } catch (error: any) {
    console.error("Shopify Webhook processing failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- DEFAULT PRODUCTS AUTOMATIC SEEDER ON BOOT ---
const ensureDefaultProducts = async () => {
  try {
    const dbProds = await db.select().from(products);
    if (dbProds.length === 0) {
      console.log("[Products Seeder] Seeding default products and variants...");
      const sampleProducts = [
        { title: "LEGO Star Wars Millennium Falcon 75257", category: "Construction", ageRange: "9-12", sku: "LEGO-SW-75257", cost: "110.00", sell: "169.99", img: "https://images.unsplash.com/photo-1589254065878-42c9da997008?w=300" },
        { title: "Barbie Maison de Rêve (Dreamhouse)", category: "Poupées", ageRange: "3-6", sku: "BARB-DREAM-01", cost: "165.00", sell: "249.99", img: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300" },
        { title: "Playmobil Château des Chevaliers", category: "Figurines", ageRange: "6-12", sku: "PLAY-KNI-305", cost: "48.00", sell: "89.99", img: "https://images.unsplash.com/photo-1566577134770-3d85bb3a9cc4?w=300" },
        { title: "Hot Wheels Volcan Super Collision", category: "Véhicules", ageRange: "3-6", sku: "HW-VOLC-10", cost: "32.00", sell: "64.99", img: "https://images.unsplash.com/photo-1594787318286-3d835c1d207f?w=300" },
        { title: "Nerf Elite 2.0 Shockwave RD-15", category: "Plein Air", ageRange: "12+", sku: "NERF-SHOCK-15", cost: "14.50", sell: "29.99", img: "https://images.unsplash.com/photo-1531315630201-bb15abeb1653?w=300" },
        { title: "Peluche Stitch Géante 80cm", category: "Peluches", ageRange: "0-3", sku: "PEL-STITCH-80", cost: "22.00", sell: "49.99", img: "https://images.unsplash.com/photo-1559251606-c623743a6d76?w=300" },
        { title: "GraviTrax Coffret de Départ XXL", category: "Logique & Construction", ageRange: "9-12", sku: "GRAVI-START-01", cost: "35.00", sell: "69.90", img: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=300" },
        { title: "Jeux de Société Catan (Édition Française)", category: "Jeux de Société", ageRange: "12+", sku: "BOARD-CATAN-FR", cost: "24.00", sell: "44.99", img: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=300" }
      ];

      for (const p of sampleProducts) {
        const insertedProduct = await db.insert(products).values({
          title: p.title,
          description: `Superbe jouet de haute qualité de la marque.`,
          category: p.category,
          ageRange: p.ageRange,
          status: "active",
        }).returning();

        const insertedVar = await db.insert(variants).values({
          productId: insertedProduct[0].id,
          sku: p.sku,
          barcode: "BAR-" + p.sku,
          costPrice: p.cost,
          sellingPrice: p.sell,
          imageUrl: p.img,
          stock: 35,
          reservedStock: 0
        }).returning();

        // Connect variant to all 4 Shopify brands
        const brands = ["magijouets", "libijouets", "allez_jouets", "kids_heaven"];
        for (const b of brands) {
          await db.insert(shopifyConnections).values({
            variantId: insertedVar[0].id,
            brand: b,
            shopifyProductId: "shop_p_" + insertedProduct[0].id,
            shopifyVariantId: "shop_v_" + insertedVar[0].id
          });
        }
      }
      console.log("[Products Seeder] Seeded default products and variants successfully.");
    }
  } catch (err) {
    console.error("[Products Seeder] Failed to seed default products:", err);
  }
};
ensureDefaultProducts();

// --- ONLINE ORDERS DASHBOARD ---

// Get all Shopify imported orders across brands directly (no auto-seeding of orders here)
router.get("/orders", requireAuth, async (req, res) => {
  try {
    const list = await db
      .select()
      .from(shopifyOrders)
      .orderBy(desc(shopifyOrders.createdAt));

    const items = await db.select().from(shopifyOrderItems);

    const fullOrders = list.map((ord) => {
      const oItems = items.filter((it) => it.shopifyOrderId === ord.id);
      return { ...ord, items: oItems };
    });

    res.json(fullOrders);
  } catch (error: any) {
    console.error("Failed to load orders:", error);
    res.status(500).json({ error: error.message });
  }
});

// Explicitly seed the database with demo orders
router.post("/orders/seed", requireAuth, async (req, res) => {
  try {
    // Delete existing orders first
    await db.delete(shopifyOrderItems);
    await db.delete(shopifyOrders);

    // Make sure we have products
    await ensureDefaultProducts();

    const dbProds = await db.select().from(products);
    const vList = await db.select().from(variants);

    const seedOrdersData = [
      { num: "#MJ-1024", brand: "magijouets", customer: "Thomas Dubois", phone: "+33 6 12 34 56 78", city: "Paris", address: "12 Rue de la Paix", total: "179.89", status: "Nouvelle", title: "LEGO Star Wars Millennium Falcon 75257", dCost: "9.90", pPrice: "110.00", fees: "0.00", clot: "non", notes: "Client attend avec impatience pour anniversaire." },
      { num: "#LJ-2041", brand: "libijouets", customer: "Sarah Martin", phone: "+33 7 98 76 54 32", city: "Lyon", address: "45 Avenue des Frères Lumière", total: "254.89", status: "Confirmée", title: "Barbie Maison de Rêve (Dreamhouse)", dCost: "4.90", pPrice: "165.00", fees: "1.50", clot: "non", notes: "Demande emballage cadeau si possible." },
      { num: "#AJ-3005", brand: "allez_jouets", customer: "Alexandre Bernard", phone: "+33 6 55 44 33 22", city: "Marseille", address: "8 Rue Saint-Ferréol", total: "95.89", status: "Envoyée", title: "Playmobil Château des Chevaliers", dCost: "5.90", pPrice: "48.00", fees: "2.00", clot: "non", notes: "Numéro de suivi Colissimo transmis." },
      { num: "#KH-4521", brand: "kids_heaven", customer: "Élodie Petit", phone: "+33 6 88 77 66 55", city: "Toulouse", address: "102 Boulevard de Strasbourg", total: "64.99", status: "Livrée", title: "Hot Wheels Volcan Super Collision", dCost: "0.00", pPrice: "32.00", fees: "0.00", clot: "non", notes: "Colis déposé en boîte aux lettres." },
      { num: "#MJ-1025", brand: "magijouets", customer: "Nicolas Richard", phone: "+33 7 23 45 67 89", city: "Nice", address: "14 Promenade des Anglais", total: "35.89", status: "Retournée", title: "Nerf Elite 2.0 Shockwave RD-15", dCost: "5.90", pPrice: "14.50", fees: "0.00", clot: "non", notes: "Retourné par l'acheteur - boîte non ouverte." },
      { num: "#LJ-2042", brand: "libijouets", customer: "Julien Moreau", phone: "+33 6 32 14 56 98", city: "Nantes", address: "3 Rue Crébillon", total: "49.99", status: "Annulée", title: "Peluche Stitch Géante 80cm", dCost: "0.00", pPrice: "22.00", fees: "0.00", clot: "non", notes: "Annulé par le client avant expédition." },
      { num: "#AJ-3006", brand: "allez_jouets", customer: "Chloé Durand", phone: "+33 7 11 22 33 44", city: "Strasbourg", address: "19 Rue de la Nuée-Bleue", total: "75.80", status: "Clôturée", title: "GraviTrax Coffret de Départ XXL", dCost: "5.90", pPrice: "35.00", fees: "1.00", clot: "oui", notes: "Vente parfaitement finalisée et clôturée." },
      { num: "#KH-4522", brand: "kids_heaven", customer: "Maxime Lemaire", phone: "+33 6 74 85 96 12", city: "Bordeaux", address: "28 Rue Sainte-Catherine", total: "44.99", status: "Livrée", title: "Jeux de Société Catan (Édition Française)", dCost: "0.00", pPrice: "24.00", fees: "0.00", clot: "non", notes: "Remis en main propre." },
      { num: "#MJ-1026", brand: "magijouets", customer: "Sophie Lefebvre", phone: "+33 6 85 96 32 14", city: "Lille", address: "78 Rue Nationale", total: "174.89", status: "Confirmée", title: "LEGO Star Wars Millennium Falcon 75257", dCost: "4.90", pPrice: "110.00", fees: "0.00", clot: "non", notes: "Paiement validé." },
      { num: "#LJ-2043", brand: "libijouets", customer: "Antoine Laurent", phone: "+33 7 54 82 13 97", city: "Rennes", address: "11 Place de la Mairie", total: "75.80", status: "Nouvelle", title: "GraviTrax Coffret de Départ XXL", dCost: "5.90", pPrice: "35.00", fees: "0.00", clot: "non", notes: "À expédier en priorité." },
      { num: "#AJ-3007", brand: "allez_jouets", customer: "Camille Simon", phone: "+33 6 12 78 34 56", city: "Paris", address: "89 Rue de Rivoli", total: "249.99", status: "Livrée", title: "Barbie Maison de Rêve (Dreamhouse)", dCost: "0.00", pPrice: "165.00", fees: "0.00", clot: "non", notes: "Livraison effectuée à l'accueil de l'immeuble." },
      { num: "#KH-4523", brand: "kids_heaven", customer: "Lucas Michel", phone: "+33 6 99 88 11 22", city: "Lyon", address: "50 Boulevard de la Croix-Rousse", total: "35.89", status: "Envoyée", title: "Nerf Elite 2.0 Shockwave RD-15", dCost: "5.90", pPrice: "14.50", fees: "1.00", clot: "non", notes: "En transit via Mondial Relay." },
      { num: "#MJ-1027", brand: "magijouets", customer: "Léa Garcia", phone: "+33 7 41 85 29 63", city: "Marseille", address: "5 Avenue du Prado", total: "94.89", status: "Clôturée", title: "Playmobil Château des Chevaliers", dCost: "4.90", pPrice: "48.00", fees: "1.50", clot: "oui", notes: "Archivée et comptabilisée." },
      { num: "#LJ-2044", brand: "libijouets", customer: "Pierre Roux", phone: "+33 6 15 24 33 42", city: "Toulouse", address: "64 Rue d'Alsace-Lorraine", total: "49.99", status: "Livrée", title: "Peluche Stitch Géante 80cm", dCost: "0.00", pPrice: "22.00", fees: "0.50", clot: "non", notes: "Parfait." },
      { num: "#AJ-3008", brand: "allez_jouets", customer: "Manon David", phone: "+33 6 36 98 52 14", city: "Bordeaux", address: "3 Place de la Bourse", total: "64.99", status: "Confirmée", title: "Hot Wheels Volcan Super Collision", dCost: "0.00", pPrice: "32.00", fees: "0.00", clot: "non", notes: "Vérifier la couleur de l'emballage." },
      { num: "#KH-4524", brand: "kids_heaven", customer: "Hugo Bertrand", phone: "+33 7 14 25 36 96", city: "Paris", address: "125 Avenue Victor Hugo", total: "44.99", status: "Clôturée", title: "Jeux de Société Catan (Édition Française)", dCost: "0.00", pPrice: "24.00", fees: "0.00", clot: "oui", notes: "Clôture comptable automatique." }
    ];

    for (const ord of seedOrdersData) {
      const matchingVar = vList.find((v) => {
        const prod = dbProds.find((p) => p.title === ord.title);
        return prod ? v.productId === prod.id : false;
      });
      const localVariantId = matchingVar ? matchingVar.id : (vList[0]?.id || 1);
      const shopifyOrderIdMock = "mock_ord_" + Math.floor(Math.random() * 1000000);

      const createdOrd = await db.insert(shopifyOrders).values({
        shopifyOrderId: shopifyOrderIdMock,
        orderNumber: ord.num,
        brand: ord.brand,
        customerName: ord.customer,
        customerPhone: ord.phone,
        customerCity: ord.city,
        address1: ord.address,
        totalPrice: ord.total,
        paymentStatus: "paid",
        fulfillmentStatus: ord.status === "Livrée" || ord.status === "Clôturée" ? "fulfilled" : (ord.status === "Annulée" ? "cancelled" : "unfulfilled"),
        reservationStatus: ord.status === "Nouvelle" || ord.status === "Confirmée" || ord.status === "Envoyée" ? "reserved" : "released",
        status: ord.status,
        productTitle: ord.title,
        deliveryCost: ord.dCost,
        purchasePrice: ord.pPrice,
        extraFees: ord.fees,
        cloturee: ord.clot,
        notes: ord.notes,
        createdAt: new Date(Date.now() - Math.random() * 10 * 24 * 3600 * 1000)
      }).returning();

      await db.insert(shopifyOrderItems).values({
        shopifyOrderId: createdOrd[0].id,
        variantId: localVariantId,
        quantity: 1,
        shopifyVariantId: "mock_shop_var_" + localVariantId,
        price: ord.total
      });
    }

    res.json({ success: true, message: "Les 16 commandes de démonstration ont été ensemencées." });
  } catch (error: any) {
    console.error("Failed to seed orders:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new order (Google Sheets style or manual physical) with active stock reservation/adjustments
router.post("/orders", requireAuth, async (req, res) => {
  try {
    const {
      orderNumber,
      brand,
      customerName,
      customerPhone,
      customerCity,
      address1,
      totalPrice,
      status,
      productTitle,
      deliveryCost,
      purchasePrice,
      extraFees,
      cloturee,
      notes,
      variantId,
      quantity,
    } = req.body;

    if (!orderNumber || !brand || !customerName) {
      return res.status(400).json({ error: "Le numéro de commande, la marque et le nom du client sont requis." });
    }

    const shopifyOrderIdMock = "manual_ord_" + Math.floor(Math.random() * 1000000);

    const result = await db.transaction(async (tx) => {
      const created = await tx
        .insert(shopifyOrders)
        .values({
          shopifyOrderId: shopifyOrderIdMock,
          orderNumber,
          brand: brand.toLowerCase(),
          customerName,
          customerPhone: customerPhone || "",
          customerCity: customerCity || "",
          address1: address1 || "",
          totalPrice: totalPrice || "0.00",
          paymentStatus: "paid",
          fulfillmentStatus: status === "Livrée" || status === "Clôturée" ? "fulfilled" : (status === "Annulée" ? "cancelled" : "unfulfilled"),
          reservationStatus: status === "Nouvelle" || status === "Confirmée" || status === "Envoyée" ? "reserved" : "released",
          status: status || "Nouvelle",
          productTitle: productTitle || "",
          deliveryCost: deliveryCost || "0.00",
          purchasePrice: purchasePrice || "0.00",
          extraFees: extraFees || "0.00",
          cloturee: cloturee || "non",
          notes: notes || "",
          createdAt: new Date(),
          shopifyCreatedAt: new Date(),
        })
        .returning();

      const orderRecord = created[0];

      if (variantId) {
        const itemQty = parseInt(quantity || 1);
        const vList = await tx
          .select()
          .from(variants)
          .where(eq(variants.id, parseInt(variantId)))
          .limit(1);

        if (vList.length > 0) {
          const v = vList[0];
          const previousStock = v.stock;
          let newStock = previousStock;
          let newReserved = v.reservedStock;

          const isReserving = status === "Nouvelle" || status === "Confirmée" || status === "Envoyée";
          const isFulfilling = status === "Livrée" || status === "Clôturée";

          if (isReserving) {
            newStock = previousStock - itemQty;
            newReserved = v.reservedStock + itemQty;
          } else if (isFulfilling) {
            newStock = previousStock - itemQty;
          }

          if (isReserving || isFulfilling) {
            await tx
              .update(variants)
              .set({
                stock: newStock,
                reservedStock: newReserved,
              })
              .where(eq(variants.id, v.id));

            // Log Stock Movement
            await tx.insert(stockMovements).values({
              variantId: v.id,
              type: "shopify_order",
              quantity: -itemQty,
              previousStock,
              newStock,
              reason: `Commande manuelle ${orderNumber} (Stock -${itemQty}${isReserving ? `, Réservé +${itemQty}` : ""})`,
            });
          }

          // Insert Order Item
          await tx.insert(shopifyOrderItems).values({
            shopifyOrderId: orderRecord.id,
            variantId: v.id,
            quantity: itemQty,
            shopifyVariantId: "manual_var_" + v.id,
            price: totalPrice || "0.00",
          });
        }
      }

      return orderRecord;
    });

    res.json(result);
  } catch (error: any) {
    console.error("Failed to create manual order:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper to adjust stock levels during order status transitions
async function adjustStockForStatusTransition(tx: any, orderId: number, oldStatus: string, newStatus: string) {
  if (oldStatus === newStatus) return;

  const GroupReserved = ["Nouvelle", "Confirmée", "Envoyée"];
  const GroupFulfilled = ["Livrée", "Clôturée"];
  const GroupReleased = ["Annulée", "Retournée"];

  const getGroup = (status: string) => {
    if (GroupReserved.includes(status)) return "RESERVED";
    if (GroupFulfilled.includes(status)) return "FULFILLED";
    return "RELEASED";
  };

  const oldGroup = getGroup(oldStatus);
  const newGroup = getGroup(newStatus);

  if (oldGroup === newGroup) return;

  // Fetch items for this order
  const orderItems = await tx
    .select()
    .from(shopifyOrderItems)
    .where(eq(shopifyOrderItems.shopifyOrderId, orderId));

  for (const item of orderItems) {
    const qty = item.quantity || 1;
    const vId = item.variantId;
    if (!vId) continue;

    const vList = await tx
      .select()
      .from(variants)
      .where(eq(variants.id, vId))
      .limit(1);

    if (vList.length === 0) continue;
    const v = vList[0];

    const previousStock = v.stock;
    let stockDelta = 0;
    let reservedDelta = 0;

    if (oldGroup === "RESERVED") {
      if (newGroup === "FULFILLED") {
        reservedDelta = -qty;
      } else if (newGroup === "RELEASED") {
        stockDelta = qty;
        reservedDelta = -qty;
      }
    } else if (oldGroup === "FULFILLED") {
      if (newGroup === "RESERVED") {
        reservedDelta = qty;
      } else if (newGroup === "RELEASED") {
        stockDelta = qty;
      }
    } else if (oldGroup === "RELEASED") {
      if (newGroup === "RESERVED") {
        stockDelta = -qty;
        reservedDelta = qty;
      } else if (newGroup === "FULFILLED") {
        stockDelta = -qty;
      }
    }

    if (stockDelta !== 0 || reservedDelta !== 0) {
      const newStock = previousStock + stockDelta;
      const newReserved = v.reservedStock + reservedDelta;

      await tx
        .update(variants)
        .set({
          stock: newStock,
          reservedStock: newReserved,
        })
        .where(eq(variants.id, vId));

      await tx.insert(stockMovements).values({
        variantId: vId,
        type: stockDelta > 0 ? "return" : "shopify_order",
        quantity: stockDelta !== 0 ? stockDelta : reservedDelta,
        previousStock,
        newStock,
        reason: `Statut Commande #${orderId} (${oldStatus} -> ${newStatus}): Stock ${stockDelta >= 0 ? "+" : ""}${stockDelta}, Réservé ${reservedDelta >= 0 ? "+" : ""}${reservedDelta}`,
      });
    }
  }
}

// Edit order inline or in full (Airtable / Google Sheets style)
router.put("/orders/:id", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const updates = req.body;

    const result = await db.transaction(async (tx) => {
      const existingList = await tx
        .select()
        .from(shopifyOrders)
        .where(eq(shopifyOrders.id, orderId))
        .limit(1);

      if (existingList.length === 0) {
        throw new Error("Commande introuvable");
      }

      const oldStatus = existingList[0].status;
      const newStatus = updates.status || oldStatus;

      // Adapt reservationStatus and fulfillmentStatus based on the status being modified
      let reservationStatus = existingList[0].reservationStatus;
      let fulfillmentStatus = existingList[0].fulfillmentStatus;

      if (updates.status) {
        if (updates.status === "Livrée" || updates.status === "Clôturée") {
          reservationStatus = "released";
          fulfillmentStatus = "fulfilled";
        } else if (updates.status === "Annulée" || updates.status === "Retournée") {
          reservationStatus = "released";
          fulfillmentStatus = "cancelled";
        } else if (updates.status === "Nouvelle" || updates.status === "Confirmée" || updates.status === "Envoyée") {
          reservationStatus = "reserved";
          fulfillmentStatus = "unfulfilled";
        }
      }

      // Perform stock changes if any
      await adjustStockForStatusTransition(tx, orderId, oldStatus, newStatus);

      const updated = await tx
        .update(shopifyOrders)
        .set({
          orderNumber: updates.orderNumber,
          brand: updates.brand !== undefined ? updates.brand.toLowerCase() : undefined,
          customerName: updates.customerName,
          customerPhone: updates.customerPhone,
          customerCity: updates.customerCity,
          address1: updates.address1,
          totalPrice: updates.totalPrice,
          status: updates.status,
          productTitle: updates.productTitle,
          deliveryCost: updates.deliveryCost,
          purchasePrice: updates.purchasePrice,
          extraFees: updates.extraFees,
          cloturee: updates.cloturee,
          notes: updates.notes,
          reservationStatus,
          fulfillmentStatus,
        })
        .where(eq(shopifyOrders.id, orderId))
        .returning();

      return updated[0];
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk status update for spreadsheet
router.post("/orders/bulk-status", requireAuth, async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ error: "Paramètres 'ids' et 'status' requis." });
    }

    const updatedOrders = [];
    for (const id of ids) {
      const result = await db.transaction(async (tx) => {
        const existingList = await tx
          .select()
          .from(shopifyOrders)
          .where(eq(shopifyOrders.id, id))
          .limit(1);

        if (existingList.length === 0) return null;

        const oldStatus = existingList[0].status;
        if (oldStatus === status) return existingList[0];

        let reservationStatus = "reserved";
        let fulfillmentStatus = "unfulfilled";

        if (status === "Livrée" || status === "Clôturée") {
          reservationStatus = "released";
          fulfillmentStatus = "fulfilled";
        } else if (status === "Annulée" || status === "Retournée") {
          reservationStatus = "released";
          fulfillmentStatus = "cancelled";
        }

        await adjustStockForStatusTransition(tx, id, oldStatus, status);

        const updated = await tx
          .update(shopifyOrders)
          .set({
            status,
            cloturee: status === "Clôturée" ? "oui" : "non",
            reservationStatus,
            fulfillmentStatus,
          })
          .where(eq(shopifyOrders.id, id))
          .returning();

        return updated[0];
      });

      if (result) {
        updatedOrders.push(result);
      }
    }

    res.json({ success: true, updated: updatedOrders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Register a return (direct product return or link to order)
router.post("/orders/register-return", requireAuth, async (req, res) => {
  try {
    const { orderId, variantId, quantity, reason, condition, notes, customerName, brand, orderNumber, totalPrice } = req.body;
    const qty = parseInt(quantity || 1);

    if (orderId) {
      const existing = await db
        .select()
        .from(shopifyOrders)
        .where(eq(shopifyOrders.id, parseInt(orderId)))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Commande introuvable" });
      }

      const order = existing[0];
      const oldStatus = order.status;
      const finalNotes = `${order.notes || ""}\n[Retour Enregistré] Raison: ${reason || "Non spécifiée"}. Condition: ${condition === "restocked" ? "Remis en stock" : "Défectueux"}. ${notes || ""}`;

      const updated = await db.transaction(async (tx) => {
        await adjustStockForStatusTransition(tx, order.id, oldStatus, "Retournée");

        if (condition === "damaged") {
          const items = await tx
            .select()
            .from(shopifyOrderItems)
            .where(eq(shopifyOrderItems.shopifyOrderId, order.id));

          for (const item of items) {
            const vId = item.variantId;
            if (!vId) continue;

            const vList = await tx.select().from(variants).where(eq(variants.id, vId)).limit(1);
            if (vList.length > 0) {
              const v = vList[0];
              const previousStock = v.stock;
              const newStock = previousStock - item.quantity;

              await tx.update(variants).set({ stock: newStock }).where(eq(variants.id, vId));

              await tx.insert(stockMovements).values({
                variantId: vId,
                type: "damaged",
                quantity: -item.quantity,
                previousStock,
                newStock,
                reason: `Retour commande #${order.id} défectueux (rebut)`,
              });
            }
          }
        }

        const result = await tx
          .update(shopifyOrders)
          .set({
            status: "Retournée",
            notes: finalNotes,
            reservationStatus: "released",
            fulfillmentStatus: "cancelled",
          })
          .where(eq(shopifyOrders.id, order.id))
          .returning();

        return result[0];
      });

      return res.json({ success: true, order: updated });
    } else {
      const shopifyOrderIdMock = "return_ord_" + Math.floor(Math.random() * 1000000);
      const finalOrderNumber = orderNumber || `#RET-${Math.floor(Math.random() * 9000 + 1000)}`;

      const created = await db.transaction(async (tx) => {
        const createdOrder = await tx
          .insert(shopifyOrders)
          .values({
            shopifyOrderId: shopifyOrderIdMock,
            orderNumber: finalOrderNumber,
            brand: (brand || "magijouets").toLowerCase(),
            customerName: customerName || "Retour Libre",
            totalPrice: totalPrice || "0.00",
            status: "Retournée",
            notes: `[Retour Libre] Raison: ${reason || "Non spécifiée"}. Condition: ${condition === "restocked" ? "Remis en stock" : "Défectueux"}. ${notes || ""}`,
            paymentStatus: "paid",
            fulfillmentStatus: "cancelled",
            reservationStatus: "released",
            createdAt: new Date(),
          })
          .returning();

        const orderRecord = createdOrder[0];

        if (variantId) {
          const vList = await tx
            .select()
            .from(variants)
            .where(eq(variants.id, parseInt(variantId)))
            .limit(1);

          if (vList.length > 0) {
            const v = vList[0];
            const previousStock = v.stock;
            let newStock = previousStock;

            if (condition === "restocked") {
              newStock = previousStock + qty;

              await tx
                .update(variants)
                .set({ stock: newStock })
                .where(eq(variants.id, v.id));

              await tx.insert(stockMovements).values({
                variantId: v.id,
                type: "return",
                quantity: qty,
                previousStock,
                newStock,
                reason: `Retour libre enregistré ${finalOrderNumber} (Stock +${qty})`,
              });
            } else {
              await tx.insert(stockMovements).values({
                variantId: v.id,
                type: "damaged",
                quantity: 0,
                previousStock,
                newStock,
                reason: `Retour libre enregistré ${finalOrderNumber} (Défectueux, stock non réintégré)`,
              });
            }

            await tx.insert(shopifyOrderItems).values({
              shopifyOrderId: orderRecord.id,
              variantId: v.id,
              quantity: qty,
              shopifyVariantId: "manual_var_" + v.id,
              price: totalPrice || "0.00",
            });
          }
        }

        return orderRecord;
      });

      return res.json({ success: true, order: created });
    }
  } catch (error: any) {
    console.error("Failed to register return:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete an order
router.delete("/orders/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(shopifyOrders).where(eq(shopifyOrders.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Import orders from CSV/Google Sheets JSON
router.post("/orders/import", requireAuth, async (req, res) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: "Format de données invalide." });
    }

    const imported = [];
    for (const row of rows) {
      const shopifyOrderIdMock = "import_ord_" + Math.floor(Math.random() * 1000000);
      const created = await db
        .insert(shopifyOrders)
        .values({
          shopifyOrderId: shopifyOrderIdMock,
          orderNumber: row.orderNumber || row["Order Num"] || `#IMP-${Math.floor(Math.random() * 9000 + 1000)}`,
          brand: (row.brand || row["Marque"] || "magijouets").toLowerCase(),
          customerName: row.customerName || row["Nom client"] || "Client Importé",
          customerPhone: row.customerPhone || row["Phone"] || "",
          customerCity: row.customerCity || row["City"] || "",
          address1: row.address1 || row["Address 1"] || "",
          totalPrice: String(row.totalPrice || row["Total Price"] || "0.00"),
          status: row.status || row["État"] || "Nouvelle",
          productTitle: row.productTitle || row["Product Title"] || "",
          deliveryCost: String(row.deliveryCost || row["Delivery"] || "0.00"),
          purchasePrice: String(row.purchasePrice || row["Prix d’achat"] || "0.00"),
          extraFees: String(row.extraFees || "0.00"),
          cloturee: row.cloturee || row["Clôturée"] || "non",
          paymentStatus: "paid",
          fulfillmentStatus: "unfulfilled",
          createdAt: new Date(),
        })
        .returning();
      imported.push(created[0]);
    }

    res.json({ success: true, count: imported.length, imported });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Force-reset/seed the database with clean orders
router.post("/orders/reset", requireAuth, async (req, res) => {
  try {
    await db.delete(shopifyOrders);
    res.json({ success: true, message: "Les commandes ont été réinitialisées avec succès. Rechargez pour auto-générer de nouvelles données." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fulfill Shopify Order: release reservations (reserved stock goes down!)
router.post("/orders/:id/fulfill", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    const orderList = await db
      .select()
      .from(shopifyOrders)
      .where(eq(shopifyOrders.id, orderId))
      .limit(1);

    if (orderList.length === 0) {
      return res.status(404).json({ error: "Shopify order not found" });
    }

    const order = orderList[0];
    if (order.reservationStatus !== "reserved") {
      return res.status(400).json({ error: "Order reservation is already released or fulfilled" });
    }

    const items = await db
      .select()
      .from(shopifyOrderItems)
      .where(eq(shopifyOrderItems.shopifyOrderId, orderId));

    await db.transaction(async (tx) => {
      // Set statuses
      await tx
        .update(shopifyOrders)
        .set({
          fulfillmentStatus: "fulfilled",
          reservationStatus: "fulfilled",
        })
        .where(eq(shopifyOrders.id, orderId));

      for (const item of items) {
        // Decrease reserved stock by order quantity
        const vList = await tx.select().from(variants).where(eq(variants.id, item.variantId)).limit(1);
        if (vList.length === 0) continue;

        const currentVar = vList[0];
        const newReserved = Math.max(0, currentVar.reservedStock - item.quantity);

        await tx
          .update(variants)
          .set({ reservedStock: newReserved })
          .where(eq(variants.id, item.variantId));
      }
    });

    res.json({ success: true, message: "Order fulfilled and reservation released." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel Shopify Order: restore physical stock and decrease reservation
router.post("/orders/:id/cancel", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    const orderList = await db
      .select()
      .from(shopifyOrders)
      .where(eq(shopifyOrders.id, orderId))
      .limit(1);

    if (orderList.length === 0) {
      return res.status(404).json({ error: "Shopify order not found" });
    }

    const order = orderList[0];
    if (order.reservationStatus !== "reserved") {
      return res.status(400).json({ error: "Cannot cancel order that is already processed" });
    }

    const items = await db
      .select()
      .from(shopifyOrderItems)
      .where(eq(shopifyOrderItems.shopifyOrderId, orderId));

    await db.transaction(async (tx) => {
      // Set statuses
      await tx
        .update(shopifyOrders)
        .set({
          fulfillmentStatus: "cancelled",
          reservationStatus: "released",
        })
        .where(eq(shopifyOrders.id, orderId));

      for (const item of items) {
        const vList = await tx.select().from(variants).where(eq(variants.id, item.variantId)).limit(1);
        if (vList.length === 0) continue;

        const currentVar = vList[0];
        const previousStock = currentVar.stock;
        const newStock = previousStock + item.quantity;
        const newReserved = Math.max(0, currentVar.reservedStock - item.quantity);

        // Put physical stock back and release reserved stock
        await tx
          .update(variants)
          .set({
            stock: newStock,
            reservedStock: newReserved,
          })
          .where(eq(variants.id, item.variantId));

        // Insert stock movement for cancellation
        await tx.insert(stockMovements).values({
          variantId: item.variantId,
          type: "return",
          quantity: item.quantity,
          previousStock,
          newStock,
          reason: `Shopify Order ${order.orderNumber} Cancelled [${order.brand}] (Stock Restored)`,
        });
      }
    });

    // Sync inventory to Shopify brands linked to these variants
    for (const item of items) {
      queueStockSync(item.variantId).catch((e) =>
        console.error(`Failed to sync Shopify stock for variant ${item.variantId} after Shopify order cancel:`, e),
      );
    }

    res.json({ success: true, message: "Order cancelled, physical stock restored, and reservation released." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reset & Re-seed orders table
router.post("/orders/reset", requireAuth, async (req, res) => {
  try {
    await db.delete(shopifyOrderItems);
    await db.delete(shopifyOrders);
    res.json({ success: true, message: "Base de données réinitialisée. Seeding automatique activé." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
