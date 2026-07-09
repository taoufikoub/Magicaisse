import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { shopifyConnections, shopifySyncQueue, variants } from "../db/schema.ts";

// Define brand type
export type ShopifyBrand = "magijouets" | "libijouets" | "allez_jouets" | "kids_heaven";

export interface ShopifyConfig {
  shopUrl?: string;
  accessToken?: string;
  locationId?: string;
}

// Read brand configurations from env with sensible defaults or leave undefined for simulation
export const getShopifyConfig = (brand: ShopifyBrand): ShopifyConfig => {
  const prefix = brand.toUpperCase().replace("-", "_");
  return {
    shopUrl: process.env[`SHOPIFY_${prefix}_SHOP`] || undefined,
    accessToken: process.env[`SHOPIFY_${prefix}_TOKEN`] || undefined,
    locationId: process.env[`SHOPIFY_${prefix}_LOCATION_ID`] || undefined,
  };
};

/**
 * Real Shopify GraphQL API call to set inventory level.
 * Falls back to simulation if credentials are not configured, logging the exact details.
 */
export async function syncInventoryToShopify(
  brand: ShopifyBrand,
  inventoryItemId: string,
  quantity: number,
  overrideLocationId?: string,
): Promise<{ success: boolean; error?: string; simulated: boolean }> {
  const config = getShopifyConfig(brand);
  const locationId = overrideLocationId || config.locationId;

  if (!config.shopUrl || !config.accessToken || !locationId) {
    // Graceful simulation when no credentials exist
    console.log(
      `[Shopify Sync SIMULATOR] Brand: ${brand} | Inventory Item: ${inventoryItemId} | Location: ${locationId || "default"} | New Qty: ${quantity}`,
    );
    return { success: true, simulated: true };
  }

  // Clean the shop URL
  let shop = config.shopUrl;
  if (!shop.startsWith("https://")) {
    shop = `https://${shop}`;
  }
  if (shop.endsWith("/")) {
    shop = shop.slice(0, -1);
  }

  const endpoint = `${shop}/admin/api/2024-04/graphql.json`;

  const query = `
    mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
      inventorySetOnHandQuantities(input: $input) {
        inventoryAdjustmentGroup {
          createdAt
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Format the location id to ensure it's a gid if needed (Shopify uses gid://shopify/Location/12345)
  const formattedLocationId = locationId.startsWith("gid://shopify/Location/")
    ? locationId
    : `gid://shopify/Location/${locationId}`;

  const formattedInventoryItemId = inventoryItemId.startsWith("gid://shopify/InventoryItem/")
    ? inventoryItemId
    : `gid://shopify/InventoryItem/${inventoryItemId}`;

  const variables = {
    input: {
      reason: "correction",
      setQuantities: [
        {
          inventoryItemId: formattedInventoryItemId,
          locationId: formattedLocationId,
          quantity: quantity,
        },
      ],
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text}`, simulated: false };
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      return { success: false, error: data.errors[0].message, simulated: false };
    }

    const userErrors = data.data?.inventorySetOnHandQuantities?.userErrors;
    if (userErrors && userErrors.length > 0) {
      return { success: false, error: userErrors[0].message, simulated: false };
    }

    return { success: true, simulated: false };
  } catch (err: any) {
    return { success: false, error: err.message || String(err), simulated: false };
  }
}

/**
 * Queue a stock sync for all Shopify connections linked to a specific local variant.
 * If exceptBrand is provided, we skip syncing to that brand (useful for incoming Shopify order hooks!).
 */
export async function queueStockSync(
  variantId: number,
  exceptBrand?: string,
): Promise<void> {
  try {
    // 1. Fetch variant and its connections
    const localConnections = await db
      .select()
      .from(shopifyConnections)
      .where(eq(shopifyConnections.variantId, variantId));

    const localVariant = await db
      .select()
      .from(variants)
      .where(eq(variants.id, variantId));

    if (localVariant.length === 0) return;
    const v = localVariant[0];

    // Shopify inventory available to sell is master physical stock - reserved stock
    const availableQty = Math.max(0, v.stock - v.reservedStock);

    for (const conn of localConnections) {
      if (exceptBrand && conn.brand === exceptBrand) {
        continue;
      }

      if (!conn.shopifyInventoryItemId) {
        continue;
      }

      // Create sync queue entry
      await db.insert(shopifySyncQueue).values({
        variantId,
        brand: conn.brand,
        actionType: "update_inventory",
        payload: JSON.stringify({
          inventoryItemId: conn.shopifyInventoryItemId,
          quantity: availableQty,
          locationId: conn.shopifyLocationId,
        }),
        status: "pending",
        attempts: 0,
      });
    }

    // Proactively fire the background worker so syncing is fast!
    processSyncQueue().catch((e) => console.error("Error in processSyncQueue background worker:", e));
  } catch (error) {
    console.error("Failed to queue stock sync:", error);
  }
}

/**
 * Background worker to process all pending sync queue tasks with retries.
 */
export async function processSyncQueue(): Promise<void> {
  try {
    // Find pending or failed tasks with < 3 attempts
    const pendingTasks = await db
      .select()
      .from(shopifySyncQueue)
      .where(eq(shopifySyncQueue.status, "pending"));

    for (const task of pendingTasks) {
      const payloadObj = JSON.parse(task.payload);
      const { inventoryItemId, quantity, locationId } = payloadObj;

      await db
        .update(shopifySyncQueue)
        .set({
          attempts: task.attempts + 1,
          lastAttempt: new Date(),
        })
        .where(eq(shopifySyncQueue.id, task.id));

      const result = await syncInventoryToShopify(
        task.brand as ShopifyBrand,
        inventoryItemId,
        quantity,
        locationId,
      );

      if (result.success) {
        await db
          .update(shopifySyncQueue)
          .set({
            status: "success",
            errorMessage: null,
          })
          .where(eq(shopifySyncQueue.id, task.id));
      } else {
        const nextStatus = task.attempts + 1 >= 3 ? "failed" : "pending";
        await db
          .update(shopifySyncQueue)
          .set({
            status: nextStatus,
            errorMessage: result.error || "Unknown Shopify API error",
          })
          .where(eq(shopifySyncQueue.id, task.id));
      }
    }
  } catch (error) {
    console.error("Error in Shopify sync queue worker:", error);
  }
}
