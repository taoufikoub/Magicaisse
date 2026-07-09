import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  ShoppingBag,
  ExternalLink,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Check,
} from "lucide-react";

interface ShopifyOrder {
  id: number;
  shopifyOrderId: string;
  orderNumber: string;
  brand: "magijouets" | "libijouets" | "allez_jouets" | "kids_heaven";
  customerName: string | null;
  customerPhone: string | null;
  customerCity: string | null;
  totalPrice: string | null;
  paymentStatus: string;
  fulfillmentStatus: string;
  reservationStatus: "reserved" | "released" | "fulfilled";
  shopifyCreatedAt: string | null;
  createdAt: string;
}

export default function ShopifyOrders() {
  const { fetchWithAuth } = useAuth();
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ShopifyOrder[]>([]);
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/shopify/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        applyFilters(data, search, selectedBrand);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (list: ShopifyOrder[], query: string, brand: string) => {
    let result = [...list];
    if (brand !== "all") {
      result = result.filter((o) => o.brand === brand);
    }
    if (query) {
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(query.toLowerCase()) ||
          (o.customerName && o.customerName.toLowerCase().includes(query.toLowerCase())) ||
          (o.customerCity && o.customerCity.toLowerCase().includes(query.toLowerCase())),
      );
    }
    setFilteredOrders(result);
  };

  const handleSearchChange = (q: string) => {
    setSearch(q);
    applyFilters(orders, q, selectedBrand);
  };

  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    applyFilters(orders, search, brand);
  };

  const handleFulfill = async (orderId: number) => {
    if (!confirm("Are you sure you want to mark this Shopify order as fulfilled? This will release reserved stock units from inventory.")) return;
    try {
      const res = await fetchWithAuth(`/api/shopify/orders/${orderId}/fulfill`, {
        method: "POST",
      });
      if (res.ok) {
        fetchOrders();
      } else {
        alert("Failed to fulfill order");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancel = async (orderId: number) => {
    if (!confirm("Are you sure you want to cancel this order? This will restore the reserved toy stock units back into active master inventory.")) return;
    try {
      const res = await fetchWithAuth(`/api/shopify/orders/${orderId}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        fetchOrders();
      } else {
        alert("Failed to cancel order");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getBrandBadgeClass = (brand: string) => {
    switch (brand) {
      case "magijouets":
        return "bg-sky-100 text-sky-800 border-sky-200";
      case "libijouets":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "allez_jouets":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "kids_heaven":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getBrandLabel = (brand: string) => {
    switch (brand) {
      case "magijouets":
        return "Magijouets";
      case "libijouets":
        return "Libijouets";
      case "allez_jouets":
        return "Allez Jouets";
      case "kids_heaven":
        return "Kids Heaven";
      default:
        return brand;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 h-full flex flex-col text-slate-800">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 mb-5 space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-extrabold text-lg text-slate-800 leading-tight">Shopify Online Orders</h2>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
              Multi-Brand Shared Stock Fulfillment Hub
            </p>
          </div>
        </div>

        <button
          onClick={fetchOrders}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search order #, customer, city..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
          />
        </div>

        <div className="md:col-span-8 flex flex-wrap gap-2">
          <button
            onClick={() => handleBrandChange("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              selectedBrand === "all"
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Online Brands
          </button>
          <button
            onClick={() => handleBrandChange("magijouets")}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              selectedBrand === "magijouets"
                ? "bg-sky-600 text-white border-sky-600"
                : "bg-white text-sky-700 border-sky-200 hover:bg-sky-50"
            }`}
          >
            Magijouets
          </button>
          <button
            onClick={() => handleBrandChange("libijouets")}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              selectedBrand === "libijouets"
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-purple-700 border-purple-200 hover:bg-purple-50"
            }`}
          >
            Libijouets
          </button>
          <button
            onClick={() => handleBrandChange("allez_jouets")}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              selectedBrand === "allez_jouets"
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-white text-orange-700 border-orange-200 hover:bg-orange-50"
            }`}
          >
            Allez Jouets
          </button>
          <button
            onClick={() => handleBrandChange("kids_heaven")}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              selectedBrand === "kids_heaven"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
            }`}
          >
            Kids Heaven
          </button>
        </div>
      </div>

      {/* Orders List Table */}
      <div className="flex-1 overflow-x-auto min-h-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Brand</th>
              <th className="py-3 px-4">Order Number</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">City</th>
              <th className="py-3 px-4 text-right">Total Price</th>
              <th className="py-3 px-4">Payment</th>
              <th className="py-3 px-4">Fulfillment</th>
              <th className="py-3 px-4">Reserved Status</th>
              <th className="py-3 px-4 text-center">Fulfill / Cancel Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm">
            {filteredOrders.map((ord) => (
              <tr key={ord.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-4 px-4 whitespace-nowrap">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${getBrandBadgeClass(ord.brand)}`}>
                    {getBrandLabel(ord.brand)}
                  </span>
                </td>
                <td className="py-4 px-4 font-mono font-bold text-slate-800">
                  {ord.orderNumber}
                </td>
                <td className="py-4 px-4 font-semibold text-slate-700">
                  {ord.customerName || "No Name"}
                  {ord.customerPhone && (
                    <span className="block text-xs font-normal text-slate-400">{ord.customerPhone}</span>
                  )}
                </td>
                <td className="py-4 px-4 text-slate-500 font-medium">
                  {ord.customerCity || "N/A"}
                </td>
                <td className="py-4 px-4 text-right font-extrabold text-slate-800">
                  ${parseFloat(ord.totalPrice || "0.00").toFixed(2)}
                </td>
                <td className="py-4 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    ord.paymentStatus === "paid"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {ord.paymentStatus}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    ord.fulfillmentStatus === "fulfilled"
                      ? "bg-emerald-100 text-emerald-800"
                      : ord.fulfillmentStatus === "cancelled"
                      ? "bg-slate-100 text-slate-800"
                      : "bg-orange-100 text-orange-800"
                  }`}>
                    {ord.fulfillmentStatus}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                    ord.reservationStatus === "reserved"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : ord.reservationStatus === "fulfilled"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}>
                    {ord.reservationStatus === "reserved" ? "🔒 Reserved Stock" : "🔓 Released"}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center justify-center space-x-2">
                    {ord.reservationStatus === "reserved" && (
                      <>
                        <button
                          onClick={() => handleFulfill(ord.id)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl flex items-center space-x-1 transition-all"
                          title="Release reserved stock to fill order"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Fulfill</span>
                        </button>
                        <button
                          onClick={() => handleCancel(ord.id)}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center space-x-1 transition-all"
                          title="Put stock back to master catalog"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel Order</span>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  No online Shopify orders found matching selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
