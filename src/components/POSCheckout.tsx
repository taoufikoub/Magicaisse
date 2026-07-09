import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  Barcode,
  Calculator,
  Plus,
  Minus,
  Trash2,
  Search,
  UserPlus,
  Coins,
  CreditCard,
  Gift,
  Printer,
  ShoppingBag,
  CheckCircle,
  X,
  AlertTriangle,
} from "lucide-react";

interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  barcode: string | null;
  sellingPrice: string;
  costPrice: string;
  stock: number;
  productTitle?: string;
  category?: string;
  imageUrl?: string | null;
}

interface CartItem {
  variantId: number;
  title: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discount: number; // in percentage or fixed, let's use fixed discount
  stock: number;
}

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  city: string | null;
}

interface ActiveSession {
  id: number;
  openingCash: string;
  status: string;
}

export default function POSCheckout({ activeSession, onRefreshSessions }: { activeSession: ActiveSession | null, onRefreshSessions: () => void }) {
  const { fetchWithAuth, dbUser } = useAuth();
  const [productsList, setProductsList] = useState<any[]>([]);
  const [flatVariants, setFlatVariants] = useState<ProductVariant[]>([]);
  const [searchResults, setSearchResults] = useState<ProductVariant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [cartDiscount, setCartDiscount] = useState<string>("0");
  
  // New Customer Form State
  const [showAddCust, setShowAddCust] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustCity, setNewCustCity] = useState("");

  // Receipt Modal State
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetchWithAuth("/api/products/products");
      if (res.ok) {
        const data = await res.json();
        setProductsList(data);
        // Flatten variants for easier POS search
        const flat: ProductVariant[] = [];
        data.forEach((p: any) => {
          if (p.variants) {
            p.variants.forEach((v: any) => {
              flat.push({
                ...v,
                productTitle: p.title,
                category: p.category,
              });
            });
          }
        });
        setFlatVariants(flat);
        setSearchResults(flat.slice(0, 8)); // default view
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomers = async () => {
    try {
      // In a real application, we would have a dedicated endpoint
      const res = await fetchWithAuth("/api/sales/sales");
      // Let's seed with some mock customers or create a quick custom list
      setCustomers([
        { id: 1, name: "Walk-in Customer", phone: "", city: "" },
        { id: 2, name: "Alice Dupont", phone: "0612345678", city: "Paris" },
        { id: 3, name: "Marc Leclerc", phone: "0788776655", city: "Lyon" },
        { id: 4, name: "Sophie Lambert", phone: "0622334455", city: "Marseille" },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q) {
      setSearchResults(flatVariants.slice(0, 8));
      return;
    }
    const filtered = flatVariants.filter(
      (v) =>
        v.sku.toLowerCase().includes(q.toLowerCase()) ||
        (v.barcode && v.barcode.includes(q)) ||
        (v.productTitle && v.productTitle.toLowerCase().includes(q.toLowerCase())) ||
        (v.category && v.category.toLowerCase().includes(q.toLowerCase())),
    );
    setSearchResults(filtered);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery) return;

    const matched = flatVariants.find(
      (v) => v.barcode === barcodeQuery || v.sku.toLowerCase() === barcodeQuery.toLowerCase(),
    );

    if (matched) {
      addToCart(matched);
      setBarcodeQuery("");
    } else {
      alert(`No product found with barcode or SKU: "${barcodeQuery}"`);
    }
  };

  const addToCart = (v: ProductVariant) => {
    const existing = cart.find((item) => item.variantId === v.id);
    if (existing) {
      if (existing.quantity >= v.stock) {
        alert(`Cannot add more. Master stock limit reached (${v.stock} available)`);
        return;
      }
      setCart(
        cart.map((item) =>
          item.variantId === v.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      );
    } else {
      if (v.stock <= 0) {
        alert("Warning: Stock is currently 0. Selling this item will result in negative inventory.");
      }
      setCart([
        ...cart,
        {
          variantId: v.id,
          title: v.productTitle || "Unknown Toy",
          sku: v.sku,
          unitPrice: parseFloat(v.sellingPrice),
          quantity: 1,
          discount: 0,
          stock: v.stock,
        },
      ]);
    }
  };

  const updateCartQty = (variantId: number, change: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.variantId === variantId) {
            const nextQty = item.quantity + change;
            if (nextQty <= 0) return null;
            if (nextQty > item.stock && change > 0) {
              alert(`Cannot exceed available physical stock (${item.stock} units)`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[],
    );
  };

  const removeCartItem = (variantId: number) => {
    setCart(cart.filter((item) => item.variantId !== variantId));
  };

  const handleItemDiscount = (variantId: number, discountStr: string) => {
    const disc = parseFloat(discountStr) || 0;
    setCart(
      cart.map((item) => (item.variantId === variantId ? { ...item, discount: disc } : item)),
    );
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName) return;
    const newCust: Customer = {
      id: Date.now(),
      name: newCustName,
      phone: newCustPhone || null,
      city: newCustCity || null,
    };
    setCustomers([...customers, newCust]);
    setSelectedCustomer(String(newCust.id));
    setNewCustName("");
    setNewCustPhone("");
    setNewCustCity("");
    setShowAddCust(false);
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.unitPrice - item.discount) * item.quantity, 0);
  };

  const getTotal = () => {
    const sub = getSubtotal();
    const disc = parseFloat(cartDiscount) || 0;
    return Math.max(0, sub - disc);
  };

  const handleCheckout = async () => {
    if (!activeSession) {
      alert("CRITICAL ERROR: Please open the Cash Register Session first before completing any sales!");
      return;
    }

    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    const payload = {
      customerId: selectedCustomer || null,
      sessionId: activeSession.id,
      paymentMethod,
      discountAmount: parseFloat(cartDiscount).toFixed(2),
      totalAmount: getTotal().toFixed(2),
      items: cart.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        discount: item.discount.toFixed(2),
        totalPrice: ((item.unitPrice - item.discount) * item.quantity).toFixed(2),
      })),
    };

    try {
      const res = await fetchWithAuth("/api/sales/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setCompletedSale(data);
        setShowReceipt(true);
        setCart([]);
        setCartDiscount("0");
        fetchProducts(); // refresh stock numbers!
      } else {
        const err = await res.json();
        alert("Checkout Failed: " + (err.error || "Unknown server error"));
      }
    } catch (error) {
      alert("Failed to reach server");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[calc(100vh-140px)] text-slate-800">
      {/* LEFT: Catalog and Scanning (7 cols) */}
      <div className="lg:col-span-7 flex flex-col space-y-4 h-auto lg:h-full">
        {/* Quick Barcode Scanner Emulation */}
        <form
          onSubmit={handleBarcodeSubmit}
          className="bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-xl p-4 flex items-center space-x-3 shadow-sm"
        >
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100">
            <Barcode className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wide">
              Emulate Barcode Scanner (Press Enter to Scan)
            </label>
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan Barcode or enter SKU..."
              value={barcodeQuery}
              onChange={(e) => setBarcodeQuery(e.target.value)}
              className="w-full bg-transparent border-none text-sm font-bold text-indigo-900 placeholder-indigo-400 focus:outline-none"
            />
          </div>
        </form>

        {/* Search and Catalog Selection */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
          <div className="flex items-center space-x-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search toys by title, category, SKU, or age..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {searchResults.map((v) => (
                <button
                  key={v.id}
                  onClick={() => addToCart(v)}
                  className="flex flex-col text-left p-3.5 bg-slate-50 hover:bg-indigo-50/20 hover:border-indigo-100 border border-slate-200 rounded-xl transition-all group relative overflow-hidden shadow-sm"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    {v.category}
                  </span>
                  <span className="font-semibold text-slate-800 group-hover:text-indigo-900 line-clamp-2 leading-tight flex-1 mb-2 text-sm">
                    {v.productTitle}
                  </span>
                  <div className="flex items-baseline justify-between w-full mt-auto">
                    <span className="font-extrabold text-base text-indigo-600">{v.sellingPrice} DH</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        v.stock <= 0
                          ? "bg-rose-50 text-rose-700 border border-rose-100"
                          : v.stock <= 5
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      }`}
                    >
                      {v.stock} left
                    </span>
                  </div>
                </button>
              ))}
              {searchResults.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 text-sm">
                  No matching toys found. Try another search.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: POS Checkout Cart (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col h-auto lg:h-full min-h-[400px] lg:min-h-0">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-base text-slate-800">Checkout Basket</h2>
          </div>
          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
          </span>
        </div>

        {/* Warning if no active cash session */}
        {!activeSession && (
          <div className="mb-4 bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex items-start space-x-3 text-rose-800">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block">Cash Register Closed</span>
              You must open a Cash Session (Register) in the left menu before checking out any physical sales.
            </div>
          </div>
        )}

        {/* Cart List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 max-h-[350px] lg:max-h-none">
          {cart.map((item) => (
            <div
              key={item.variantId}
              className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between"
            >
              <div className="flex-1 min-w-0 pr-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 block tracking-wider uppercase">
                  SKU: {item.sku}
                </span>
                <h4 className="font-semibold text-slate-800 truncate leading-tight mb-1 text-sm">
                  {item.title}
                </h4>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="font-bold text-indigo-600">{item.unitPrice} DH</span>
                  {item.discount > 0 && (
                    <span className="text-rose-500 font-medium">-${item.discount} disc</span>
                  )}
                </div>
              </div>

              {/* Action columns: Qty & Total */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden p-0.5">
                  <button
                    onClick={() => updateCartQty(item.variantId, -1)}
                    className="p-1 hover:bg-slate-50 text-slate-600 rounded-lg"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-slate-800">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQty(item.variantId, 1)}
                    className="p-1 hover:bg-slate-50 text-slate-600 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-right w-16">
                  <span className="font-bold text-slate-800 block text-sm">
                    {((item.unitPrice - item.discount) * item.quantity).toFixed(2)} DH
                  </span>
                </div>

                <button
                  onClick={() => removeCartItem(item.variantId)}
                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400">
              <ShoppingBag className="w-12 h-12 text-slate-200 mb-2" />
              <p className="text-sm font-medium">Checkout Basket is empty</p>
              <p className="text-xs text-slate-400">Add toys from the left panel to scan items</p>
            </div>
          )}
        </div>

        {/* Summary Details */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
          {/* Customer Selection */}
          <div className="flex items-center justify-between space-x-2">
            <div className="flex-1">
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-2 focus:outline-none"
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowAddCust(true)}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md shadow-indigo-100"
              title="Add Customer"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>

          {/* Inline discount and payment options */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Basket Discount (DH)</label>
              <input
                type="number"
                min="0"
                value={cartDiscount}
                onChange={(e) => setCartDiscount(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none font-bold text-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Payment Type</label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`py-2 flex flex-col items-center justify-center rounded-lg border text-[10px] ${
                    paymentMethod === "cash"
                      ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 mb-0.5" />
                  Cash
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`py-2 flex flex-col items-center justify-center rounded-lg border text-[10px] ${
                    paymentMethod === "card"
                      ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 mb-0.5" />
                  Card
                </button>
                <button
                  onClick={() => setPaymentMethod("gift_card")}
                  className={`py-2 flex flex-col items-center justify-center rounded-lg border text-[10px] ${
                    paymentMethod === "gift_card"
                      ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Gift className="w-3.5 h-3.5 mb-0.5" />
                  Gift
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="border-t border-slate-200 pt-3 space-y-1.5">
            <div className="flex justify-between text-slate-600 text-sm">
              <span>Subtotal:</span>
              <span className="font-semibold">{getSubtotal().toFixed(2)} DH</span>
            </div>
            {parseFloat(cartDiscount) > 0 && (
              <div className="flex justify-between text-rose-600 text-sm">
                <span>Discount:</span>
                <span className="font-semibold">-{parseFloat(cartDiscount).toFixed(2)} DH</span>
              </div>
            )}
            <div className="flex justify-between text-slate-800 text-lg font-extrabold pt-1">
              <span>Grand Total:</span>
              <span className="text-indigo-600">{getTotal().toFixed(2)} DH</span>
            </div>
          </div>

          {/* Complete checkout */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || !activeSession}
            className={`w-full py-3.5 rounded-lg font-bold flex items-center justify-center space-x-2 shadow-md transition-all ${
              cart.length === 0 || !activeSession
                ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
            }`}
          >
            <Calculator className="w-5 h-5" />
            <span>Complete Sale & Print Receipt</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: ADD NEW CUSTOMER */}
      {showAddCust && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800">Add New Customer</h3>
              <button onClick={() => setShowAddCust(false)} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Full Name</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Phone Number</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 0612345678"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">City</label>
                <input
                  type="text"
                  value={newCustCity}
                  onChange={(e) => setNewCustCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Paris"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-md shadow-indigo-100"
              >
                Add & Select Customer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: GORGEOUS PHYSICAL RECEIPT PRINT PREVIEW */}
      {showReceipt && completedSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative border border-slate-200 flex flex-col">
            <button
              onClick={() => {
                setShowReceipt(false);
                setCompletedSale(null);
              }}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-full transition-all"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>

            {/* Receipt Content */}
            <div className="bg-indigo-50/40 p-5 border border-indigo-100 rounded-2xl flex flex-col items-center mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-500 mb-1.5 animate-bounce" />
              <h3 className="font-extrabold text-sm text-indigo-500 uppercase tracking-widest text-center">
                Magicaise Receipt
              </h3>
              <p className="text-2xl font-black text-indigo-600 leading-none">POS COMPLETED</p>
            </div>

            {/* Receipt Body */}
            <div className="font-mono text-xs border-dashed border-t-2 border-b-2 border-slate-200 py-4 my-2 space-y-3">
              <div className="text-center">
                <span className="font-bold text-sm block">🎪 MAGICAISE TERMINAL 🎪</span>
                <span className="text-slate-500">Shared Master POS Control</span>
              </div>

              <div className="space-y-0.5 text-slate-500">
                <div className="flex justify-between">
                  <span>RECEIPT:</span>
                  <span className="font-bold text-slate-800">{completedSale.sale?.saleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(completedSale.sale?.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>CASHIER:</span>
                  <span className="font-bold text-slate-800">{dbUser?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>PAYMENT:</span>
                  <span className="font-bold text-slate-800 uppercase">
                    {completedSale.sale?.paymentMethod}
                  </span>
                </div>
              </div>

              {/* Items list */}
              <div className="border-t border-dashed border-slate-200 pt-2.5 space-y-1.5">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-slate-800">
                    <div className="pr-2 truncate">
                      <span>{item.title}</span>
                      <span className="block text-[10px] text-slate-400">
                        {item.quantity} x {item.unitPrice} DH
                      </span>
                    </div>
                    <span className="font-bold text-right flex-shrink-0">
                      {((item.unitPrice - item.discount) * item.quantity).toFixed(2)} DH
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-dashed border-slate-200 pt-2.5 space-y-1 text-slate-800 font-bold">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>{getSubtotal().toFixed(2)} DH</span>
                </div>
                {parseFloat(cartDiscount) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>DISCOUNT:</span>
                    <span>-{parseFloat(cartDiscount).toFixed(2)} DH</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-1.5 border-t border-double border-slate-300 font-extrabold">
                  <span>TOTAL PAID:</span>
                  <span>{getTotal().toFixed(2)} DH</span>
                </div>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 font-mono mb-4">
              Thank you for shopping with us!<br />
              Inventory synced to all Shopify storefronts.
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center space-x-2 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print Physical Copy</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
