import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  Package,
  AlertTriangle,
  ClipboardList,
  Sliders,
  RefreshCw,
  Search,
  CheckCircle,
} from "lucide-react";

interface Variant {
  id: number;
  sku: string;
  stock: number;
  reservedStock: number;
  sellingPrice: string;
  productTitle?: string;
}

interface StockMovement {
  id: number;
  variantId: number;
  sku: string;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  staffName: string | null;
  createdAt: string;
}

export default function InventoryManager() {
  const { fetchWithAuth } = useAuth();
  const [variantsList, setVariantsList] = useState<Variant[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [filteredVariants, setFilteredVariants] = useState<Variant[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Manual Adjustment Form States
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("Manual correction");

  useEffect(() => {
    fetchInventory();
    fetchMovements();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/products/products");
      if (res.ok) {
        const data = await res.json();
        // Flatten variants
        const flat: Variant[] = [];
        data.forEach((p: any) => {
          if (p.variants) {
            p.variants.forEach((v: any) => {
              flat.push({
                ...v,
                productTitle: p.title,
              });
            });
          }
        });
        setVariantsList(flat);
        applyFilter(flat, search);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await fetchWithAuth("/api/inventory/movements");
      if (res.ok) {
        setMovements(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const applyFilter = (list: Variant[], query: string) => {
    if (!query) {
      setFilteredVariants(list);
      return;
    }
    const filtered = list.filter(
      (v) =>
        v.sku.toLowerCase().includes(query.toLowerCase()) ||
        (v.productTitle && v.productTitle.toLowerCase().includes(query.toLowerCase())),
    );
    setFilteredVariants(filtered);
  };

  const handleSearchChange = (q: string) => {
    setSearch(q);
    applyFilter(variantsList, q);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant || !adjustmentQty) return;

    const payload = {
      variantId: selectedVariant.id,
      adjustmentQty: parseInt(adjustmentQty),
      reason: adjustmentReason,
    };

    try {
      const res = await fetchWithAuth("/api/inventory/adjust", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSelectedVariant(null);
        setAdjustmentQty("");
        setAdjustmentReason("Manual correction");
        fetchInventory();
        fetchMovements();
      } else {
        alert("Failed to adjust inventory");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] text-slate-800">
      {/* LEFT PANEL: Master stock levels (7 cols) */}
      <div className="lg:col-span-7 flex flex-col h-full space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-slate-800">Master Stock Levels</h3>
            </div>

            <button
              onClick={() => {
                fetchInventory();
                fetchMovements();
              }}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter master stock by title or SKU..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
            />
          </div>

          {/* Stock Table List */}
          <div className="flex-1 overflow-y-auto pr-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="py-2.5">Toy Item SKU</th>
                  <th className="py-2.5 text-center">Physical Stock</th>
                  <th className="py-2.5 text-center">Reserved Online</th>
                  <th className="py-2.5 text-center">Available to Sell</th>
                  <th className="py-2.5 text-right">Correct Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVariants.map((v) => {
                  const available = Math.max(0, v.stock - v.reservedStock);
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50">
                      <td className="py-3 pr-2 font-medium text-slate-700">
                        <span className="font-mono font-bold block text-slate-800">{v.sku}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[200px] block">
                          {v.productTitle}
                        </span>
                      </td>
                      <td className="py-3 text-center font-bold text-slate-700">
                        {v.stock}
                      </td>
                      <td className="py-3 text-center text-indigo-600 font-bold">
                        {v.reservedStock}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-extrabold ${
                            available <= 0
                              ? "bg-rose-50 text-rose-700 border border-rose-100"
                              : available <= 5
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}
                        >
                          {available}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setSelectedVariant(v)}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all text-[10px] flex items-center space-x-1 ml-auto shadow-md shadow-indigo-100"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Adjust</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredVariants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No inventory records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Audit history movements feed (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col h-full min-h-0">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-4">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
          <h3 className="font-extrabold text-base text-slate-800">Master Audit Stock Movements</h3>
        </div>

        {/* Movements scrolling feed */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {movements.map((move) => (
            <div
              key={move.id}
              className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex flex-col text-xs"
            >
              <div className="flex justify-between items-start mb-1.5">
                <span className="font-mono font-bold text-slate-700">{move.sku}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    move.type === "sale"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                      : move.type === "shopify_order"
                      ? "bg-blue-50 text-blue-800 border border-blue-100"
                      : move.type === "manual_adjustment"
                      ? "bg-indigo-50 text-indigo-800 border border-indigo-100"
                      : "bg-slate-100 text-slate-800 border border-slate-200"
                  }`}
                >
                  {move.type.replace("_", " ")}
                </span>
              </div>

              <div className="flex justify-between items-baseline mb-1">
                <span className="text-slate-500 font-medium">Quantity altered:</span>
                <span className={`font-black ${move.quantity < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {move.quantity < 0 ? "" : "+"}
                  {move.quantity} units
                </span>
              </div>

              <div className="flex justify-between items-baseline text-[10px] text-slate-400 mb-1.5">
                <span>Previous: {move.previousStock}</span>
                <span>New balance: {move.newStock}</span>
              </div>

              {move.reason && (
                <p className="bg-white border border-slate-200 p-2 rounded-lg text-[10px] text-slate-600 leading-tight">
                  <span className="font-bold">Reason:</span> {move.reason}
                </p>
              )}

              <div className="flex justify-between text-[9px] text-slate-400 mt-2 pt-1 border-t border-slate-200">
                <span>By: {move.staffName || "System Shopify API"}</span>
                <span>{new Date(move.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}

          {movements.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400">
              <ClipboardList className="w-10 h-10 text-slate-200 mb-2" />
              <p className="text-xs">No stock movement logs found in database audit.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: MANUAL ADJUSTMENT FORM */}
      {selectedVariant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <h3 className="font-extrabold text-lg text-slate-800 mb-1 flex items-center space-x-1.5">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <span>Manual Stock Adjustment</span>
            </h3>
            <p className="text-xs text-slate-400 font-semibold mb-4 uppercase tracking-wider">
              Item: {selectedVariant.sku}
            </p>

            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Adjustment quantity (relative delta)
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. +10 or -5"
                  value={adjustmentQty}
                  onChange={(e) => setAdjustmentQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block leading-tight font-medium">
                  Use positive numbers to add stock received/found, use negative numbers to reduce for breakage or loss.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Reason for Adjustment
                </label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Manual stocktake reconciliation">Manual stocktake reconciliation</option>
                  <option value="Damaged toys / breakage">Damaged toys / breakage</option>
                  <option value="Store display model sample">Store display model sample</option>
                  <option value="Theft or inventory loss">Theft or inventory loss</option>
                  <option value="Supplier restock correction">Supplier restock correction</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVariant(null)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-md shadow-indigo-100"
                >
                  Apply Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
