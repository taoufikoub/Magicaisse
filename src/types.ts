export type Role = "owner" | "manager" | "cashier" | "stock manager" | "accountant";

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Supplier {
  id: number;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
}

export interface Product {
  id: number;
  title: string;
  description?: string | null;
  category: string;
  ageRange: string;
  supplierId?: number | null;
  status: "active" | "draft" | "archived";
  createdAt: string;
}

export interface Variant {
  id: number;
  productId: number;
  sku: string;
  barcode?: string | null;
  costPrice: string;
  sellingPrice: string;
  compareAtPrice?: string | null;
  imageUrl?: string | null;
  stock: number;
  reservedStock: number;
  createdAt: string;
}

export interface ShopifyConnection {
  id: number;
  variantId: number;
  brand: "magijouets" | "libijouets" | "allez_jouets" | "kids_heaven";
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
  shopifyInventoryItemId?: string | null;
  shopifyLocationId?: string | null;
  createdAt: string;
}

export interface Customer {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  createdAt: string;
}

export interface CashSession {
  id: number;
  staffId: number;
  status: "open" | "closed";
  openedAt: string;
  closedAt?: string | null;
  openingCash: string;
  expectedCash?: string | null;
  countedCash?: string | null;
  difference?: string | null;
  cardTotal: string;
  refunds: string;
  notes?: string | null;
}

export interface Sale {
  id: number;
  cashierId: number;
  customerId?: number | null;
  saleNumber: string;
  sessionId?: number | null;
  totalAmount: string;
  discountAmount: string;
  paymentMethod: string;
  createdAt: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  variantId: number;
  quantity: number;
  unitPrice: string;
  discount: string;
  totalPrice: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  status: "draft" | "ordered" | "received" | "cancelled";
  totalCost: string;
  notes?: string | null;
  createdAt: string;
  receivedAt?: string | null;
}

export interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  variantId: number;
  quantityOrdered: number;
  quantityReceived: number;
  costPrice: string;
}

export interface StockMovement {
  id: number;
  variantId: number;
  type: "sale" | "shopify_order" | "return" | "damaged" | "manual_adjustment" | "purchase_order" | "transfer";
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string | null;
  userId?: number | null;
  createdAt: string;
}

export interface ShopifyOrder {
  id: number;
  shopifyOrderId: string;
  orderNumber: string;
  brand: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerCity?: string | null;
  totalPrice?: string | null;
  paymentStatus: string;
  fulfillmentStatus: string;
  reservationStatus: "reserved" | "released" | "fulfilled";
  status: string;
  address1?: string | null;
  productTitle?: string | null;
  deliveryCost: string;
  purchasePrice: string;
  extraFees: string;
  cloturee: string;
  notes?: string | null;
  createdAt: string;
  shopifyCreatedAt?: string | null;
}

export interface ShopifySyncTask {
  id: number;
  variantId: number;
  brand: "magijouets" | "libijouets" | "allez_jouets" | "kids_heaven";
  actionType: string;
  payload: string;
  status: "pending" | "success" | "failed";
  attempts: number;
  errorMessage?: string | null;
  lastAttempt?: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  userId?: number | null;
  action: string;
  details: string;
  createdAt: string;
}
