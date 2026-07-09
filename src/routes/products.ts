import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { products, shopifyConnections, suppliers, variants } from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const router = Router();

// --- SUPPLIERS ---

router.get("/suppliers", requireAuth, async (req, res) => {
  try {
    const list = await db.select().from(suppliers).orderBy(suppliers.name);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/suppliers", requireAuth, async (req, res) => {
  try {
    const { name, contactName, email, phone, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Supplier name is required" });
    }
    const created = await db
      .insert(suppliers)
      .values({ name, contactName, email, phone, address })
      .returning();
    res.json(created[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/suppliers/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contactName, email, phone, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Supplier name is required" });
    }
    const updated = await db
      .update(suppliers)
      .set({ name, contactName, email, phone, address })
      .where(eq(suppliers.id, parseInt(id)))
      .returning();
    if (updated.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.json(updated[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- PRODUCTS & VARIANTS ---

router.get("/products", requireAuth, async (req, res) => {
  try {
    // Return flat array of products with pre-joined nested variants and connections
    const dbProducts = await db.select().from(products).orderBy(products.title);
    const dbVariants = await db.select().from(variants);
    const dbConns = await db.select().from(shopifyConnections);

    const fullProducts = dbProducts.map((p) => {
      const pVariants = dbVariants
        .filter((v) => v.productId === p.id)
        .map((v) => {
          const vConns = dbConns.filter((c) => c.variantId === v.id);
          return { ...v, shopifyConnections: vConns };
        });
      return { ...p, variants: pVariants };
    });

    res.json(fullProducts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/products", requireAuth, async (req, res) => {
  try {
    const { title, description, category, ageRange, supplierId, status, variants: listVariants } = req.body;

    if (!title || !category || !ageRange) {
      return res.status(400).json({ error: "Title, category, and age range are required." });
    }

    // Insert Product
    const createdProduct = await db
      .insert(products)
      .values({
        title,
        description,
        category,
        ageRange,
        supplierId: supplierId ? parseInt(supplierId) : null,
        status: status || "active",
      })
      .returning();

    const prod = createdProduct[0];

    // Insert Variants
    const addedVariants = [];
    if (listVariants && Array.isArray(listVariants)) {
      for (const v of listVariants) {
        const createdVariant = await db
          .insert(variants)
          .values({
            productId: prod.id,
            sku: v.sku,
            barcode: v.barcode || null,
            costPrice: v.costPrice || "0.00",
            sellingPrice: v.sellingPrice || "0.00",
            compareAtPrice: v.compareAtPrice || null,
            imageUrl: v.imageUrl || null,
            stock: v.stock !== undefined ? parseInt(v.stock) : 0,
            reservedStock: 0,
          })
          .returning();

        const insertedVar = createdVariant[0];

        // Insert Connections
        if (v.shopifyConnections && Array.isArray(v.shopifyConnections)) {
          const insertedConns = [];
          for (const conn of v.shopifyConnections) {
            const createdConn = await db
              .insert(shopifyConnections)
              .values({
                variantId: insertedVar.id,
                brand: conn.brand,
                shopifyProductId: conn.shopifyProductId || null,
                shopifyVariantId: conn.shopifyVariantId || null,
                shopifyInventoryItemId: conn.shopifyInventoryItemId || null,
                shopifyLocationId: conn.shopifyLocationId || null,
              })
              .returning();
            insertedConns.push(createdConn[0]);
          }
          addedVariants.push({ ...insertedVar, shopifyConnections: insertedConns });
        } else {
          addedVariants.push({ ...insertedVar, shopifyConnections: [] });
        }
      }
    }

    res.json({ ...prod, variants: addedVariants });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/products/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, ageRange, supplierId, status } = req.body;

    const updated = await db
      .update(products)
      .set({
        title,
        description,
        category,
        ageRange,
        supplierId: supplierId ? parseInt(supplierId) : null,
        status,
      })
      .where(eq(products.id, parseInt(id)))
      .returning();

    res.json(updated[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add a variant to a product
router.post("/products/:id/variants", requireAuth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { sku, barcode, costPrice, sellingPrice, compareAtPrice, imageUrl, stock } = req.body;

    if (!sku || !costPrice || !sellingPrice) {
      return res.status(400).json({ error: "SKU, cost price, and selling price are required." });
    }

    const created = await db
      .insert(variants)
      .values({
        productId,
        sku,
        barcode: barcode || null,
        costPrice,
        sellingPrice,
        compareAtPrice: compareAtPrice || null,
        imageUrl: imageUrl || null,
        stock: stock !== undefined ? parseInt(stock) : 0,
        reservedStock: 0,
      })
      .returning();

    res.json({ ...created[0], shopifyConnections: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Edit variant details (and update price, image, barcode)
router.put("/variants/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, barcode, costPrice, sellingPrice, compareAtPrice, imageUrl, stock } = req.body;

    const updated = await db
      .update(variants)
      .set({
        sku,
        barcode,
        costPrice,
        sellingPrice,
        compareAtPrice,
        imageUrl,
        stock: stock !== undefined ? parseInt(stock) : undefined,
      })
      .where(eq(variants.id, parseInt(id)))
      .returning();

    res.json(updated[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- CONNECTIONS ---

router.post("/shopify/connections", requireAuth, async (req, res) => {
  try {
    const { variantId, brand, shopifyProductId, shopifyVariantId, shopifyInventoryItemId, shopifyLocationId } = req.body;

    if (!variantId || !brand) {
      return res.status(400).json({ error: "variantId and brand are required" });
    }

    // Upsert or insert connection
    const created = await db
      .insert(shopifyConnections)
      .values({
        variantId: parseInt(variantId),
        brand,
        shopifyProductId: shopifyProductId || null,
        shopifyVariantId: shopifyVariantId || null,
        shopifyInventoryItemId: shopifyInventoryItemId || null,
        shopifyLocationId: shopifyLocationId || null,
      })
      .returning();

    res.json(created[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/shopify/connections/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(shopifyConnections).where(eq(shopifyConnections.id, parseInt(id)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- SCAN TOY PRODUCT IMAGE ---
router.post("/scan", requireAuth, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "L'image du jouet est requise." });
    }

    // Extract base64 and mime type
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    let mimeType = "image/jpeg";
    let base64Data = image;
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: `Analyse cette image de jouet et extrait les informations pour enrichir le catalogue. 
Retourne un objet JSON de manière rigoureuse en FRANÇAIS. 
- 'title' : Le nom ou titre du jouet en français (ex. 'Poupée Barbie Dreamhouse', 'Set Lego Star Wars X-Wing').
- 'description' : Une description claire, vendeuse et concise en français (max 2-3 phrases).
- 'category' : La catégorie de jouet parmi celles-ci : 'Jeux de société', 'Figurines', 'Poupées & Accessoires', 'Véhicules & Circuits', 'Jeux d\\'éveil & Peluches', 'Puzzles', 'Loisirs créatifs', 'Jeux de construction', 'Plein air & Sport', 'Éducatif & Scientifique'.
- 'ageRange' : Une tranche d'âge suggérée en français, par exemple : '0-3 ans', '3-6 ans', '6-9 ans', '9-12 ans', '12+ ans'.
- 'sku' : Un code SKU unique généré de façon intelligente basé sur le jouet, en majuscules (ex: JOUET-LEGO-SW-001).
- 'barcode' : Le code EAN-13 si visible sur le jouet ou l'emballage, sinon génère un code à 13 chiffres plausible (par exemple commençant par 370 pour la France).
- 'costPrice' : Un prix d'achat estimé réaliste pour ce type de jouet (ex: '14.50' ou '9.90').
- 'sellingPrice' : Un prix de vente conseillé en Euros réaliste (ex: '24.90' ou '19.99').
- 'compareAtPrice' : Un prix d'origine barré si applicable, ou 'null' s'il n'y en a pas.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Nom du jouet en français" },
            description: { type: Type.STRING, description: "Description en français" },
            category: { type: Type.STRING, description: "Catégorie suggérée" },
            ageRange: { type: Type.STRING, description: "Tranche d'âge" },
            sku: { type: Type.STRING, description: "SKU unique généré" },
            barcode: { type: Type.STRING, description: "Code EAN-13 ou code à 13 chiffres" },
            costPrice: { type: Type.STRING, description: "Prix de revient d'achat estimé" },
            sellingPrice: { type: Type.STRING, description: "Prix de vente conseillé" },
            compareAtPrice: { type: Type.STRING, description: "Prix barré ou null" },
          },
          required: ["title", "description", "category", "ageRange", "sku", "barcode", "costPrice", "sellingPrice"],
        },
      },
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Image Scan Error:", error);
    res.status(500).json({ error: "Erreur lors de l'analyse de l'image par Gemini : " + error.message });
  }
});

export default router;
