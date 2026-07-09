import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  Truck,
  Plus,
  TrendingDown,
  ShoppingBag,
  RefreshCw,
  FolderPlus,
  CheckCircle,
  FileText,
  Pencil,
} from "lucide-react";

interface Supplier {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

interface PurchaseOrderItem {
  id: number;
  variantSku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: string;
}

interface PurchaseOrder {
  id: number;
  supplierName: string;
  poNumber: string;
  status: "draft" | "sent" | "received" | "cancelled";
  totalCost: string;
  createdAt: string;
  items?: PurchaseOrderItem[];
}

interface Variant {
  id: number;
  sku: string;
  productTitle?: string;
}

export default function PurchaseOrders() {
  const { fetchWithAuth } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [variantsList, setVariantsList] = useState<Variant[]>([]);

  // Create Supplier Form State
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [supName, setSupName] = useState("");
  const [supContact, setSupContact] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("");

  // Edit Supplier Form State
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editSupName, setEditSupName] = useState("");
  const [editSupContact, setEditSupContact] = useState("");
  const [editSupEmail, setEditSupEmail] = useState("");
  const [editSupPhone, setEditSupPhone] = useState("");

  // Create PO Form State
  const [showAddPO, setShowAddPO] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poItems, setPoItems] = useState<Array<{ variantId: string; qty: string; cost: string }>>([
    { variantId: "", qty: "10", cost: "5.00" },
  ]);

  useEffect(() => {
    fetchSuppliers();
    fetchPurchaseOrders();
    fetchVariants();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await fetchWithAuth("/api/products/suppliers");
      if (res.ok) {
        setSuppliers(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const res = await fetchWithAuth("/api/inventory/po");
      if (res.ok) {
        setPurchaseOrders(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVariants = async () => {
    try {
      const res = await fetchWithAuth("/api/products/products");
      if (res.ok) {
        const data = await res.json();
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
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName) return;

    const payload = {
      name: supName,
      contactName: supContact || null,
      email: supEmail || null,
      phone: supPhone || null,
    };

    try {
      const res = await fetchWithAuth("/api/products/suppliers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowAddSupplier(false);
        setSupName("");
        setSupContact("");
        setSupEmail("");
        setSupPhone("");
        fetchSuppliers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setEditSupName(sup.name);
    setEditSupContact(sup.contactName || "");
    setEditSupEmail(sup.email || "");
    setEditSupPhone(sup.phone || "");
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier || !editSupName) return;

    const payload = {
      name: editSupName,
      contactName: editSupContact || null,
      email: editSupEmail || null,
      phone: editSupPhone || null,
    };

    try {
      const res = await fetchWithAuth(`/api/products/suppliers/${editingSupplier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditingSupplier(null);
        fetchSuppliers();
      } else {
        alert("Erreur lors de la modification du fournisseur");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !poNumber) return;

    // Filter out invalid items
    const validItems = poItems.filter((it) => it.variantId && it.qty && it.cost);
    if (validItems.length === 0) {
      alert("At least one valid variant item is required");
      return;
    }

    const payload = {
      supplierId: parseInt(selectedSupplierId),
      poNumber,
      items: validItems.map((it) => ({
        variantId: parseInt(it.variantId),
        quantityOrdered: parseInt(it.qty),
        unitCost: parseFloat(it.cost).toFixed(2),
      })),
    };

    try {
      const res = await fetchWithAuth("/api/inventory/po", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowAddPO(false);
        setSelectedSupplierId("");
        setPoNumber("");
        setPoItems([{ variantId: "", qty: "10", cost: "5.00" }]);
        fetchPurchaseOrders();
      } else {
        alert("Failed to create Purchase Order");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReceivePO = async (poId: number) => {
    if (!confirm("Are you sure you want to mark this PO as received? All items will be added to physical master inventory and synced to Shopify stores.")) return;
    try {
      const res = await fetchWithAuth(`/api/inventory/po/${poId}/receive`, {
        method: "POST",
      });
      if (res.ok) {
        fetchPurchaseOrders();
      } else {
        alert("Failed to process PO receipt");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addPOItemRow = () => {
    setPoItems([...poItems, { variantId: "", qty: "10", cost: "5.00" }]);
  };

  const updatePOItemRow = (index: number, key: string, value: string) => {
    const next = [...poItems];
    next[index] = { ...next[index], [key]: value };
    setPoItems(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] text-slate-800">
      {/* LEFT: Purchase Orders list (8 cols) */}
      <div className="lg:col-span-8 flex flex-col h-full space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-slate-800">Purchase Orders</h3>
            </div>

            <button
              onClick={() => setShowAddPO(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center space-x-1 shadow-md shadow-indigo-100 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Draft PO</span>
            </button>
          </div>

          {/* PO List Table */}
          <div className="flex-1 overflow-y-auto pr-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="py-2.5">PO Number</th>
                  <th className="py-2.5">Supplier Name</th>
                  <th className="py-2.5 text-right">Value ($)</th>
                  <th className="py-2.5 text-center">Receipt Status</th>
                  <th className="py-2.5 text-right">Fulfillment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-mono font-bold text-slate-800">
                      {po.poNumber}
                    </td>
                    <td className="py-3 font-semibold text-slate-700">
                      {po.supplierName}
                    </td>
                    <td className="py-3 text-right font-extrabold text-slate-850">
                      ${parseFloat(po.totalCost).toFixed(2)}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          po.status === "received"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                            : po.status === "sent"
                            ? "bg-sky-50 text-sky-800 border border-sky-100 animate-pulse"
                            : "bg-slate-100 text-slate-800 border border-slate-200"
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {po.status !== "received" && (
                        <button
                          onClick={() => handleReceivePO(po.id)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg shadow-md shadow-indigo-100 transition-all"
                        >
                          Receive PO
                        </button>
                      )}
                      {po.status === "received" && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center justify-end space-x-0.5">
                          <CheckCircle className="w-3 h-3" />
                          <span>Restocked</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {purchaseOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No Purchase Orders raised.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT: Suppliers management list (4 cols) */}
      <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col h-full min-h-0">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <Truck className="w-4.5 h-4.5 text-indigo-600" />
            <h3 className="font-extrabold text-base text-slate-800">Suppliers</h3>
          </div>

          <button
            onClick={() => setShowAddSupplier(true)}
            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-all"
            title="Register Supplier"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Suppliers List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {suppliers.map((sup) => (
            <div
              key={sup.id}
              className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col relative group"
            >
              <div className="flex justify-between items-start">
                <h4 className="font-extrabold text-sm text-slate-800 leading-tight mb-1">{sup.name}</h4>
                <button
                  onClick={() => handleStartEditSupplier(sup)}
                  className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 transition-all cursor-pointer opacity-100 lg:opacity-0 group-hover:opacity-100"
                  title="Modifier le fournisseur"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 font-semibold mb-2">Contact: {sup.contactName || "No contact listed"}</p>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-medium">
                <span>Email: {sup.email || "N/A"}</span>
                <span>Phone: {sup.phone || "N/A"}</span>
              </div>
            </div>
          ))}

          {suppliers.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-8 text-slate-400">
              <Truck className="w-8 h-8 text-slate-200 mb-1.5" />
              <p className="text-xs">No suppliers registered yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: ADD NEW SUPPLIER */}
      {showAddSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <h3 className="font-extrabold text-lg text-slate-800 mb-4">Add Supplier Partner</h3>
            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Company / Supplier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hasbro France"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Contact Representative</label>
                <input
                  type="text"
                  placeholder="e.g. Jean Dupont"
                  value={supContact}
                  onChange={(e) => setSupContact(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Email address</label>
                <input
                  type="email"
                  placeholder="e.g. logistics@hasbro.fr"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Phone number</label>
                <input
                  type="text"
                  placeholder="e.g. +33 1 23 45 67 89"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplier(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-md shadow-indigo-100"
                >
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1.5: EDIT SUPPLIER */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <h3 className="font-extrabold text-lg text-slate-800 mb-4">Modifier le Fournisseur</h3>
            <form onSubmit={handleUpdateSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nom du Fournisseur / Société</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Hasbro France"
                  value={editSupName}
                  onChange={(e) => setEditSupName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Représentant / Contact</label>
                <input
                  type="text"
                  placeholder="Ex: Jean Dupont"
                  value={editSupContact}
                  onChange={(e) => setEditSupContact(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Adresse Email</label>
                <input
                  type="email"
                  placeholder="Ex: logistique@hasbro.fr"
                  value={editSupEmail}
                  onChange={(e) => setEditSupEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Numéro de Téléphone</label>
                <input
                  type="text"
                  placeholder="Ex: +33 1 23 45 67 89"
                  value={editSupPhone}
                  onChange={(e) => setEditSupPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-md shadow-indigo-100"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DRAFT NEW PURCHASE ORDER */}
      {showAddPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl border border-slate-200">
            <h3 className="font-extrabold text-lg text-slate-800 mb-4 flex items-center space-x-1.5">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Raise Purchase Order Draft</span>
            </h3>

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Select Supplier</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Choose Supplier</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">PO Number (Unique)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PO-HASBRO-2026-001"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* PO Items Lines creator */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                    Purchase Line Items:
                  </span>
                  <button
                    type="button"
                    onClick={addPOItemRow}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-850 animate-pulse"
                  >
                    + Add Product Line
                  </button>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {poItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2.5 items-end">
                      <div className="col-span-6">
                        <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Variant Sku</label>
                        <select
                          required
                          value={item.variantId}
                          onChange={(e) => updatePOItemRow(index, "variantId", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Variant</option>
                          {variantsList.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.sku} - {v.productTitle}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Qty Ordered</label>
                        <input
                          type="number"
                          required
                          value={item.qty}
                          onChange={(e) => updatePOItemRow(index, "qty", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Unit Cost Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={item.cost}
                          onChange={(e) => updatePOItemRow(index, "cost", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPO(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-md shadow-indigo-100"
                >
                  Issue PO Sent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
