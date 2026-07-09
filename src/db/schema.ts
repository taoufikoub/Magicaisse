import { relations } from "drizzle-orm";
import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// 1. Staff and Roles
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique(), // Staff login username
  password: text("password"),          // Staff login password
  uid: text("uid").unique(),           // Firebase Auth UID (optional now)
  email: text("email").unique(),       // Staff email (optional now)
  name: text("name").notNull(),
  role: text("role").notNull(),        // 'owner', 'manager', 'cashier', 'stock manager', 'accountant'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales),
  cashSessions: many(cashSessions),
  stockMovements: many(stockMovements),
  auditLogs: many(auditLogs),
}));

// 2. Suppliers
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
  purchaseOrders: many(purchaseOrders),
}));

// 3. Products
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  ageRange: text("age_range").notNull(), // e.g. '0-3', '3-6', '6-12', '12+'
  supplierId: integer("supplier_id").references(() => suppliers.id),
  status: text("status").notNull().default("active"), // 'active', 'draft', 'archived'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  variants: many(variants),
}));

// 4. Product Variants
export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode").unique(),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }).notNull(),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  stock: integer("stock").notNull().default(0), // Physical POS stock
  reservedStock: integer("reserved_stock").notNull().default(0), // Unfulfilled online orders reservation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const variantsRelations = relations(variants, ({ one, many }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
  shopifyConnections: many(shopifyConnections),
  stockMovements: many(stockMovements),
  purchaseOrderItems: many(purchaseOrderItems),
  saleItems: many(saleItems),
  shopifyOrderItems: many(shopifyOrderItems),
  shopifySyncQueues: many(shopifySyncQueue),
}));

// 5. Multi-brand Shopify Connections
export const shopifyConnections = pgTable("shopify_connections", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id")
    .references(() => variants.id, { onDelete: "cascade" })
    .notNull(),
  brand: text("brand").notNull(), // 'magijouets', 'libijouets', 'allez_jouets', 'kids_heaven'
  shopifyProductId: text("shopify_product_id"),
  shopifyVariantId: text("shopify_variant_id"),
  shopifyInventoryItemId: text("shopify_inventory_item_id"),
  shopifyLocationId: text("shopify_location_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shopifyConnectionsRelations = relations(shopifyConnections, ({ one }) => ({
  variant: one(variants, {
    fields: [shopifyConnections.variantId],
    references: [variants.id],
  }),
}));

// 6. Customers
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  city: text("city"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  sales: many(sales),
}));

// 7. Cash Sessions
export const cashSessions = pgTable("cash_sessions", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id")
    .references(() => users.id)
    .notNull(),
  status: text("status").notNull(), // 'open', 'closed'
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  openingCash: numeric("opening_cash", { precision: 10, scale: 2 }).notNull(),
  expectedCash: numeric("expected_cash", { precision: 10, scale: 2 }),
  countedCash: numeric("counted_cash", { precision: 10, scale: 2 }),
  difference: numeric("difference", { precision: 10, scale: 2 }),
  cardTotal: numeric("card_total", { precision: 10, scale: 2 }).default("0.00").notNull(),
  refunds: numeric("refunds", { precision: 10, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
});

export const cashSessionsRelations = relations(cashSessions, ({ one, many }) => ({
  staff: one(users, {
    fields: [cashSessions.staffId],
    references: [users.id],
  }),
  sales: many(sales),
}));

// 8. POS Sales
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  cashierId: integer("cashier_id")
    .references(() => users.id)
    .notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  saleNumber: text("sale_number").notNull().unique(), // POS-XXXXXX
  sessionId: integer("session_id").references(() => cashSessions.id),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  paymentMethod: text("payment_method").notNull(), // 'cash', 'card', 'gift_card', 'mixed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const salesRelations = relations(sales, ({ one, many }) => ({
  cashier: one(users, {
    fields: [sales.cashierId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  session: one(cashSessions, {
    fields: [sales.sessionId],
    references: [cashSessions.id],
  }),
  items: many(saleItems),
}));

// 9. POS Sale Items
export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .references(() => sales.id, { onDelete: "cascade" })
    .notNull(),
  variantId: integer("variant_id")
    .references(() => variants.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
});

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  variant: one(variants, {
    fields: [saleItems.variantId],
    references: [variants.id],
  }),
}));

// 10. Purchase Orders
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(), // PO-XXXXXX
  supplierId: integer("supplier_id")
    .references(() => suppliers.id)
    .notNull(),
  status: text("status").notNull(), // 'draft', 'ordered', 'received', 'cancelled'
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  receivedAt: timestamp("received_at"),
});

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  items: many(purchaseOrderItems),
}));

// 11. Purchase Order Items
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id")
    .references(() => purchaseOrders.id, { onDelete: "cascade" })
    .notNull(),
  variantId: integer("variant_id")
    .references(() => variants.id)
    .notNull(),
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").default(0).notNull(),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }).notNull(),
});

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  variant: one(variants, {
    fields: [purchaseOrderItems.variantId],
    references: [variants.id],
  }),
}));

// 12. Stock Movements (Audit History)
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id")
    .references(() => variants.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(), // 'sale', 'shopify_order', 'return', 'damaged', 'manual_adjustment', 'purchase_order', 'transfer'
  quantity: integer("quantity").notNull(), // can be positive or negative
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  reason: text("reason"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  variant: one(variants, {
    fields: [stockMovements.variantId],
    references: [variants.id],
  }),
  user: one(users, {
    fields: [stockMovements.userId],
    references: [users.id],
  }),
}));

// 13. Online Shopify Orders Dashboard
export const shopifyOrders = pgTable("shopify_orders", {
  id: serial("id").primaryKey(),
  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  orderNumber: text("order_number").notNull(), // e.g. '#1001'
  brand: text("brand").notNull(), // 'magijouets', 'libijouets', 'allez_jouets', 'kids_heaven'
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerCity: text("customer_city"),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }),
  paymentStatus: text("payment_status").notNull(), // 'paid', 'pending', 'refunded'
  fulfillmentStatus: text("fulfillment_status").notNull(), // 'fulfilled', 'unfulfilled', 'partially_fulfilled'
  reservationStatus: text("reservation_status").notNull().default("reserved"), // 'reserved', 'released', 'fulfilled'
  status: text("status").notNull().default("Nouvelle"), // 'Nouvelle', 'Confirmée', 'Envoyée', 'Livrée', 'Retournée', 'Annulée', 'Clôturée'
  address1: text("address_1"),
  productTitle: text("product_title"),
  deliveryCost: numeric("delivery_cost", { precision: 10, scale: 2 }).default("0.00").notNull(),
  purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }).default("0.00").notNull(),
  extraFees: numeric("extra_fees", { precision: 10, scale: 2 }).default("0.00").notNull(),
  cloturee: text("cloturee").notNull().default("non"), // 'oui', 'non'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  shopifyCreatedAt: timestamp("shopify_created_at"),
});

export const shopifyOrdersRelations = relations(shopifyOrders, ({ many }) => ({
  items: many(shopifyOrderItems),
}));

// 14. Shopify Order Items
export const shopifyOrderItems = pgTable("shopify_order_items", {
  id: serial("id").primaryKey(),
  shopifyOrderId: integer("shopify_order_id")
    .references(() => shopifyOrders.id, { onDelete: "cascade" })
    .notNull(),
  variantId: integer("variant_id")
    .references(() => variants.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  shopifyVariantId: text("shopify_variant_id"),
  price: numeric("price", { precision: 10, scale: 2 }),
});

export const shopifyOrderItemsRelations = relations(shopifyOrderItems, ({ one }) => ({
  shopifyOrder: one(shopifyOrders, {
    fields: [shopifyOrderItems.shopifyOrderId],
    references: [shopifyOrders.id],
  }),
  variant: one(variants, {
    fields: [shopifyOrderItems.variantId],
    references: [variants.id],
  }),
}));

// 15. Shopify Sync Queue (Retry system and error dashboard)
export const shopifySyncQueue = pgTable("shopify_sync_queue", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id")
    .references(() => variants.id, { onDelete: "cascade" })
    .notNull(),
  brand: text("brand").notNull(), // 'magijouets', 'libijouets', 'allez_jouets', 'kids_heaven'
  actionType: text("action_type").notNull().default("update_inventory"),
  payload: text("payload").notNull(), // JSON string
  status: text("status").notNull().default("pending"), // 'pending', 'success', 'failed'
  attempts: integer("attempts").notNull().default(0),
  errorMessage: text("error_message"),
  lastAttempt: timestamp("last_attempt"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shopifySyncQueueRelations = relations(shopifySyncQueue, ({ one }) => ({
  variant: one(variants, {
    fields: [shopifySyncQueue.variantId],
    references: [variants.id],
  }),
}));

// 16. General Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // 'user_login', 'sale_completed', 'stock_adjusted', etc.
  details: text("details").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
