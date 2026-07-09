import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Search,
  RefreshCw,
  PlusCircle,
  X,
  Plus,
  RotateCcw as RotateIcon
} from "lucide-react";

interface ShopifyOrder {
  id: number;
  shopifyOrderId: string;
  orderNumber: string;
  brand: string;
  customerName: string | null;
  customerPhone: string | null;
  customerCity: string | null;
  address1: string | null;
  totalPrice: string | null;
  status: string;
  productTitle: string | null;
  deliveryCost: string;
  purchasePrice: string;
  cloturee: string;
  notes: string | null;
  createdAt: string;
}

export default function RetoursTracker() {
  const { fetchWithAuth } = useAuth();
  const [returns, setReturns] = useState<ShopifyOrder[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [catalogVariants, setCatalogVariants] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  
  // Return Creation Modal
  const [newReturnModal, setNewReturnModal] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [returnType, setReturnType] = useState<"linked" | "free">("linked");

  const [newReturn, setNewReturn] = useState({
    orderId: "",
    variantId: "",
    quantity: 1,
    reason: "Colis refusé",
    condition: "restocked", // 'restocked' or 'damaged'
    notes: "",
    customerName: "",
    brand: "magijouets",
    orderNumber: "",
    totalPrice: ""
  });

  useEffect(() => {
    fetchReturns();
    fetchAllOrders();
    fetchCatalog();
  }, []);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/shopify/orders");
      if (res.ok) {
        const data = await res.json();
        // Filter by returned or cancelled status
        const filtered = data.filter((o: ShopifyOrder) => o.status === "Retournée" || o.status === "Annulée");
        setReturns(filtered);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllOrders = async () => {
    try {
      const res = await fetchWithAuth("/api/shopify/orders");
      if (res.ok) {
        const data = await res.json();
        setAllOrders(data);
      }
    } catch (e) {
      console.error("Failed to fetch all orders:", e);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await fetchWithAuth("/api/products");
      if (res.ok) {
        const data = await res.json();
        const flat: any[] = [];
        data.forEach((p: any) => {
          if (p.variants && Array.isArray(p.variants)) {
            p.variants.forEach((v: any) => {
              flat.push({
                variantId: v.id,
                title: `${p.title} - ${v.sku}`,
                costPrice: v.costPrice,
                sellingPrice: v.sellingPrice,
                productTitle: p.title,
                stock: v.stock
              });
            });
          }
        });
        setCatalogVariants(flat);
      }
    } catch (e) {
      console.error("Failed to fetch products:", e);
    }
  };

  const handleRestock = async (order: ShopifyOrder) => {
    if (!confirm(`Voulez-vous réintégrer "${order.productTitle}" de la commande ${order.orderNumber} dans le stock disponible ?`)) return;
    try {
      // Update order status to "Clôturée" or log restocking in order notes
      const res = await fetchWithAuth(`/api/shopify/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Clôturée",
          cloturee: "oui",
          notes: (order.notes || "") + "\n[Restock] Article réintégré au stock physique."
        })
      });
      if (res.ok) {
        alert("Stock physique mis à jour et commande clôturée.");
        fetchReturns();
        fetchCatalog();
        fetchAllOrders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkDamaged = async (order: ShopifyOrder) => {
    if (!confirm(`Marquer "${order.productTitle}" de la commande ${order.orderNumber} comme défectueux/endommagé ?`)) return;
    try {
      // Update order status and record damaged state in order notes
      const res = await fetchWithAuth(`/api/shopify/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Clôturée",
          cloturee: "oui",
          notes: (order.notes || "") + "\n[Défectueux] Jouet marqué endommagé. Non réintégré au stock."
        })
      });
      if (res.ok) {
        alert("Enregistré comme stock endommagé.");
        fetchReturns();
        fetchCatalog();
        fetchAllOrders();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (returnType === "linked" && !newReturn.orderId) {
      alert("Veuillez sélectionner une commande existante.");
      return;
    }
    if (returnType === "free" && !newReturn.customerName) {
      alert("Veuillez saisir le nom du client.");
      return;
    }

    setIsSubmitLoading(true);
    try {
      const payload = {
        orderId: returnType === "linked" ? parseInt(newReturn.orderId) : undefined,
        variantId: newReturn.variantId ? parseInt(newReturn.variantId) : undefined,
        quantity: newReturn.quantity,
        reason: newReturn.reason,
        condition: newReturn.condition,
        notes: newReturn.notes,
        customerName: returnType === "free" ? newReturn.customerName : undefined,
        brand: returnType === "free" ? newReturn.brand : undefined,
        orderNumber: returnType === "free" ? newReturn.orderNumber : undefined,
        totalPrice: returnType === "free" ? newReturn.totalPrice : undefined,
      };

      const res = await fetchWithAuth("/api/shopify/orders/register-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Retour enregistré avec succès !");
        setNewReturnModal(false);
        // Reset form
        setNewReturn({
          orderId: "",
          variantId: "",
          quantity: 1,
          reason: "Colis refusé",
          condition: "restocked",
          notes: "",
          customerName: "",
          brand: "magijouets",
          orderNumber: "",
          totalPrice: ""
        });
        fetchReturns();
        fetchAllOrders();
        fetchCatalog();
      } else {
        const errData = await res.json();
        alert(errData.error || "Une erreur est survenue.");
      }
    } catch (err) {
      console.error("Failed to register return:", err);
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const filteredReturns = returns.filter(r => {
    const q = search.toLowerCase();
    return (
      (r.customerName && r.customerName.toLowerCase().includes(q)) ||
      (r.orderNumber && r.orderNumber.toLowerCase().includes(q)) ||
      (r.productTitle && r.productTitle.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
        <div>
          <h2 className="text-xl font-black text-slate-900">Registre des Retours & Colis Annulés</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Traitement et réintégration des retours de livraison</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setNewReturnModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Enregistrer un Retour</span>
          </button>
          
          <button
            onClick={fetchReturns}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualiser les retours</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Metric Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par client, commande ou jouet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-xs border border-slate-200 rounded-lg focus:outline-hidden"
            />
          </div>
        </div>

        <div className="bg-indigo-950 text-white p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-indigo-300 tracking-wider">Retours à traiter</p>
            <p className="text-2xl font-black mt-0.5">{filteredReturns.length}</p>
          </div>
          <div className="p-2.5 bg-indigo-900 text-indigo-300 rounded-lg">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Retours Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Commande</th>
                <th className="px-5 py-3">Marque</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Jouet concerné</th>
                <th className="px-5 py-3">État du retour</th>
                <th className="px-5 py-3">Commentaire du retour</th>
                <th className="px-5 py-3 text-right">Actions de traitement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    Aucun retour ou colis annulé en attente de traitement.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4 font-bold text-indigo-600">{r.orderNumber}</td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] uppercase font-black text-slate-500">{r.brand}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800">{r.customerName}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{r.customerPhone || "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800">{r.productTitle || "—"}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Valeur : {parseFloat(r.totalPrice || "0").toFixed(2)} DH</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        r.status === "Retournée" 
                          ? "bg-purple-100 text-purple-700 border border-purple-200" 
                          : "bg-rose-100 text-rose-700 border border-rose-200"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 max-w-[200px] truncate" title={r.notes || ""}>
                      {r.notes || <span className="italic text-slate-300">Aucune note</span>}
                    </td>
                    <td className="px-5 py-4 text-right flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => handleRestock(r)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[10px] px-3 py-1.5 rounded-lg border border-emerald-100 uppercase tracking-wider cursor-pointer"
                        title="Remettre en rayon stock disponible"
                      >
                        <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                        Remettre en Stock
                      </button>

                      <button
                        onClick={() => handleMarkDamaged(r)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-[10px] px-3 py-1.5 rounded-lg border border-rose-100 uppercase tracking-wider cursor-pointer"
                        title="Marquer comme endommagé / rebut"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                        Endommagé
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== 4. REGISTER RETURN MODAL ==================== */}
      {newReturnModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center text-slate-800">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setNewReturnModal(false)} />
          
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 z-10 relative border border-slate-100">
            <button
              onClick={() => setNewReturnModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              <RotateIcon className="w-4 h-4 text-indigo-600" />
              <span>Enregistrer un Retour Produit</span>
            </h3>

            <div className="flex bg-slate-100 p-1 rounded-lg mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setReturnType("linked")}
                className={`flex-1 py-1.5 text-center rounded-md transition-all ${returnType === "linked" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
              >
                Associer à une commande
              </button>
              <button
                type="button"
                onClick={() => setReturnType("free")}
                className={`flex-1 py-1.5 text-center rounded-md transition-all ${returnType === "free" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
              >
                Saisie libre (Sans commande)
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-4 text-xs">
              
              {returnType === "linked" ? (
                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Sélectionner la Commande</label>
                  <select
                    value={newReturn.orderId}
                    onChange={(e) => {
                      const oId = e.target.value;
                      const selected = allOrders.find(o => String(o.id) === String(oId));
                      if (selected) {
                        setNewReturn(prev => ({
                          ...prev,
                          orderId: oId,
                          customerName: selected.customerName || "",
                          brand: selected.brand || "magijouets",
                          orderNumber: selected.orderNumber || "",
                          totalPrice: selected.totalPrice || "",
                          notes: `[Retour Commande ${selected.orderNumber}]`
                        }));
                      } else {
                        setNewReturn(prev => ({
                          ...prev,
                          orderId: "",
                          customerName: "",
                          brand: "magijouets",
                          orderNumber: "",
                          totalPrice: ""
                        }));
                      }
                    }}
                    className="w-full border border-slate-200 p-2.5 rounded-lg bg-white"
                  >
                    <option value="">-- Choisir une commande --</option>
                    {allOrders
                      .filter(o => o.status !== "Retournée" && o.status !== "Annulée")
                      .map(o => (
                        <option key={o.id} value={o.id}>
                          {o.orderNumber} - {o.customerName || "Client inconnu"} ({o.brand})
                        </option>
                      ))}
                  </select>
                  {newReturn.orderId && (
                    <div className="mt-2 bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg text-[11px] leading-relaxed">
                      <p><strong>Client :</strong> {newReturn.customerName}</p>
                      <p><strong>Marque :</strong> <span className="uppercase">{newReturn.brand}</span></p>
                      <p><strong>Total Commande :</strong> {newReturn.totalPrice} DH</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 font-bold uppercase mb-1">Numéro Commande (Optionnel)</label>
                      <input
                        type="text"
                        placeholder="Ex: #RET-4011"
                        value={newReturn.orderNumber}
                        onChange={(e) => setNewReturn(prev => ({ ...prev, orderNumber: e.target.value }))}
                        className="w-full border border-slate-200 p-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-bold uppercase mb-1">Marque</label>
                      <select
                        value={newReturn.brand}
                        onChange={(e) => setNewReturn(prev => ({ ...prev, brand: e.target.value }))}
                        className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                      >
                        <option value="magijouets">Magijouets</option>
                        <option value="libijouets">Libijouets</option>
                        <option value="allez_jouets">Allez Jouets</option>
                        <option value="kids_heaven">Kids Heaven</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-500 font-bold uppercase mb-1">Nom Complet Client</label>
                      <input
                        type="text"
                        placeholder="Nom du client"
                        value={newReturn.customerName}
                        onChange={(e) => setNewReturn(prev => ({ ...prev, customerName: e.target.value }))}
                        className="w-full border border-slate-200 p-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-bold uppercase mb-1">Montant Estimé (DH)</label>
                      <input
                        type="text"
                        placeholder="0.00"
                        value={newReturn.totalPrice}
                        onChange={(e) => setNewReturn(prev => ({ ...prev, totalPrice: e.target.value }))}
                        className="w-full border border-slate-200 p-2 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 space-y-3">
                    <p className="font-bold text-[10px] uppercase text-indigo-700 tracking-wider">Association Article Catalogue</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-slate-500 font-bold uppercase mb-1">Sélectionner un Article</label>
                        <select
                          value={newReturn.variantId}
                          onChange={(e) => setNewReturn(prev => ({ ...prev, variantId: e.target.value }))}
                          className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                        >
                          <option value="">-- Choisir un produit (Optionnel) --</option>
                          {catalogVariants.map(v => (
                            <option key={v.variantId} value={v.variantId}>
                              {v.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold uppercase mb-1">Quantité</label>
                        <input
                          type="number"
                          min={1}
                          value={newReturn.quantity}
                          onChange={(e) => setNewReturn(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                          className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Motif de retour</label>
                  <select
                    value={newReturn.reason}
                    onChange={(e) => setNewReturn(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg bg-white"
                  >
                    <option value="Colis refusé">Colis refusé</option>
                    <option value="NPAI (N'habite pas à l'adresse)">NPAI (N'habite pas à l'adresse)</option>
                    <option value="Changement d'avis">Changement d'avis</option>
                    <option value="Jouet défectueux">Jouet défectueux</option>
                    <option value="Autre">Autre (Voir notes)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">État du produit & Action Stock</label>
                  <select
                    value={newReturn.condition}
                    onChange={(e) => setNewReturn(prev => ({ ...prev, condition: e.target.value }))}
                    className="w-full border border-slate-200 p-2.5 rounded-lg bg-white"
                  >
                    <option value="restocked">Remettre en stock disponible</option>
                    <option value="damaged">Défectueux / Endommagé (Rebut)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-bold uppercase mb-1">Notes / Commentaires</label>
                <textarea
                  placeholder="Détails du retour..."
                  value={newReturn.notes}
                  onChange={(e) => setNewReturn(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full border border-slate-200 p-2.5 rounded-lg h-16"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewReturnModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg shadow-sm flex items-center space-x-1"
                >
                  {isSubmitLoading ? "Enregistrement..." : "Enregistrer le Retour"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
