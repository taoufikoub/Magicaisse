import { Router } from "express";
import { and, desc, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  products,
  saleItems,
  sales,
  shopifyOrderItems,
  shopifyOrders,
  users,
  variants,
} from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    // 1. Core aggregates
    const salesHeader = await db.select().from(sales);
    const sOrders = await db.select().from(shopifyOrders);

    let posTotalSales = 0;
    let posTotalDiscount = 0;
    for (const s of salesHeader) {
      posTotalSales += parseFloat(s.totalAmount);
      posTotalDiscount += parseFloat(s.discountAmount);
    }

    let shopifyTotalSales = 0;
    for (const o of sOrders) {
      if (o.paymentStatus === "paid") {
        shopifyTotalSales += parseFloat(o.totalPrice || "0.00");
      }
    }

    // 2. Sales by brand
    const brandSales: Record<string, number> = {
      physical_pos: posTotalSales,
      magijouets: 0,
      libijouets: 0,
      allez_jouets: 0,
      kids_heaven: 0,
    };

    for (const o of sOrders) {
      if (o.paymentStatus === "paid") {
        const b = o.brand.toLowerCase();
        if (brandSales[b] !== undefined) {
          brandSales[b] += parseFloat(o.totalPrice || "0.00");
        } else {
          brandSales[b] = parseFloat(o.totalPrice || "0.00");
        }
      }
    }

    // Convert to responsive list format
    const brandSalesList = Object.entries(brandSales).map(([name, value]) => ({
      name: name === "physical_pos" ? "Physical Toy Shop POS" : name.toUpperCase().replace("_", " "),
      sales: value,
    }));

    // 3. Profit & Margin
    // Get all sale items and look up variant cost price to calculate margin
    const sItems = await db.select().from(saleItems);
    const dbVariants = await db.select().from(variants);
    const dbProducts = await db.select().from(products);

    let totalCostOfPosSold = 0;
    for (const sItem of sItems) {
      const v = dbVariants.find((v) => v.id === sItem.variantId);
      if (v) {
        totalCostOfPosSold += parseFloat(v.costPrice) * sItem.quantity;
      }
    }

    const posProfit = Math.max(0, posTotalSales - totalCostOfPosSold);
    const posMarginPercent = posTotalSales > 0 ? (posProfit / posTotalSales) * 100 : 0;

    // 4. Best sellers list (Physical POS sales count + Shopify sales count)
    const variantSalesCounts: Record<number, { qty: number; revenue: number }> = {};

    // Aggregate POS sales
    for (const sItem of sItems) {
      const vId = sItem.variantId;
      if (!variantSalesCounts[vId]) {
        variantSalesCounts[vId] = { qty: 0, revenue: 0 };
      }
      variantSalesCounts[vId].qty += sItem.quantity;
      variantSalesCounts[vId].revenue += parseFloat(sItem.totalPrice);
    }

    // Aggregate Shopify sales
    const sOrderItems = await db.select().from(shopifyOrderItems);
    for (const soItem of sOrderItems) {
      const vId = soItem.variantId;
      if (!variantSalesCounts[vId]) {
        variantSalesCounts[vId] = { qty: 0, revenue: 0 };
      }
      variantSalesCounts[vId].qty += soItem.quantity;
      variantSalesCounts[vId].revenue += parseFloat(soItem.price || "0.00") * soItem.quantity;
    }

    const bestSellers = Object.entries(variantSalesCounts)
      .map(([vIdStr, data]) => {
        const vId = parseInt(vIdStr);
        const v = dbVariants.find((x) => x.id === vId);
        const p = v ? dbProducts.find((y) => y.id === v.productId) : null;
        return {
          variantId: vId,
          sku: v?.sku || "Unknown SKU",
          title: p ? `${p.title} (${v?.sku})` : `Variant ${vId}`,
          quantitySold: data.qty,
          revenue: data.revenue,
        };
      })
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    // 5. Sales by Category
    const categorySales: Record<string, number> = {};
    for (const sItem of sItems) {
      const v = dbVariants.find((v) => v.id === sItem.variantId);
      const p = v ? dbProducts.find((p) => p.id === v.productId) : null;
      const cat = p?.category || "Other Toys";
      categorySales[cat] = (categorySales[cat] || 0) + parseFloat(sItem.totalPrice);
    }

    const categorySalesList = Object.entries(categorySales).map(([name, value]) => ({
      name,
      value,
    }));

    // 6. Cashier Staff Performance
    const cashierSales: Record<number, { name: string; salesCount: number; salesSum: number }> = {};
    const dbUsers = await db.select().from(users);

    for (const s of salesHeader) {
      const cId = s.cashierId;
      if (!cashierSales[cId]) {
        const u = dbUsers.find((user) => user.id === cId);
        cashierSales[cId] = { name: u?.name || "Cashier #" + cId, salesCount: 0, salesSum: 0 };
      }
      cashierSales[cId].salesCount += 1;
      cashierSales[cId].salesSum += parseFloat(s.totalAmount);
    }

    const staffPerformanceList = Object.values(cashierSales).sort((a, b) => b.salesSum - a.salesSum);

    // 7. Dead stock check (no sales in past 30 days)
    // For simplicity, we flag variants that are in database but have 0 units sold in the best sellers list
    const deadStockList = dbVariants
      .filter((v) => !variantSalesCounts[v.id] || variantSalesCounts[v.id].qty === 0)
      .map((v) => {
        const p = dbProducts.find((p) => p.id === v.productId);
        return {
          id: v.id,
          sku: v.sku,
          title: p ? `${p.title} (${v.sku})` : `Variant ${v.id}`,
          stock: v.stock,
          sellingPrice: v.sellingPrice,
        };
      })
      .slice(0, 10);

    // 8. Low Stock alerts list
    const lowStockList = dbVariants
      .filter((v) => v.stock <= 5)
      .map((v) => {
        const p = dbProducts.find((p) => p.id === v.productId);
        return {
          id: v.id,
          sku: v.sku,
          title: p ? `${p.title} (${v.sku})` : `Variant ${v.id}`,
          stock: v.stock,
          sellingPrice: v.sellingPrice,
        };
      });

    res.json({
      posTotalSales,
      posTotalDiscount,
      shopifyTotalSales,
      totalSales: posTotalSales + shopifyTotalSales,
      brandSales: brandSalesList,
      posProfit,
      posMarginPercent,
      bestSellers,
      categorySales: categorySalesList,
      staffPerformance: staffPerformanceList,
      deadStock: deadStockList,
      lowStock: lowStockList,
    });
  } catch (error: any) {
    console.error("Dashboard report calculation failed:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
