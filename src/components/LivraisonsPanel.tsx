import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  Truck,
  CheckCircle,
  Clock,
  Search,
  RefreshCw,
  Sliders,
  DollarSign,
  MapPin
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

export default function LivraisonsPanel() {
  const { fetchWithAuth } = useAuth();
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("all");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/shopify/orders");
      if (res.ok) {
        const data = await res.json();
        // Keep orders related to shipment (Nouvelle, Confirmée, Envoyée, Livrée, Clôturée)
        setOrders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateField = async (orderId: number, field: string, value: string) => {
    try {
      const res = await fetchWithAuth(`/api/shopify/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter list
  const shipmentOrders = orders.filter(o => o.status === "Envoyée" || o.status === "Livrée" || o.status === "Confirmée");

  const filteredShipments = shipmentOrders.filter(o => {
    const q = search.toLowerCase();
    const carrierMatch = carrierFilter === "all" || (o.notes && o.notes.toLowerCase().includes(carrierFilter.toLowerCase()));
    
    return carrierMatch && (
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
      (o.customerCity && o.customerCity.toLowerCase().includes(q))
    );
  });

  // Shipping metrics
  const activeShipmentsCount = shipmentOrders.filter(o => o.status === "Envoyée").length;
  const completedShipmentsCount = shipmentOrders.filter(o => o.status === "Livrée" || o.status === "Clôturée").length;
  const totalShippingCost = shipmentOrders.reduce((sum, o) => sum + parseFloat(o.deliveryCost || "0"), 0);
  const averageShippingCost = shipmentOrders.length > 0 ? (totalShippingCost / shipmentOrders.length) : 0;

  // Extract carrier from notes or default to "Colissimo"
  const getCarrierName = (notes: string | null) => {
    if (!notes) return "Colissimo";
    const n = notes.toLowerCase();
    if (n.includes("dhl")) return "DHL Express";
    if (n.includes("relay") || n.includes("mondial")) return "Mondial Relay";
    if (n.includes("fedex")) return "FedEx";
    if (n.includes("chronopost")) return "Chronopost";
    return "Colissimo";
  };

  const handleCarrierChange = (order: ShopifyOrder, carrier: string) => {
    const cleanNotes = (order.notes || "").replace(/\[Transporteur:.*?\]/g, "").trim();
    const newNotes = `${cleanNotes} [Transporteur: ${carrier}]`.trim();
    handleUpdateField(order.id, "notes", newNotes);
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      
      {/* 1. Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
        <div>
          <h2 className="text-xl font-black text-slate-900">Centre d’Expédition & Livraisons</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Suivi des coûts logistiques et attribution des transporteurs</p>
        </div>
        <button
          onClick={fetchOrders}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* 2. KPIs Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">En cours d'expédition</p>
          <div className="flex items-center space-x-2 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
            <p className="text-xl font-black">{activeShipmentsCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Livrées avec succès</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{completedShipmentsCount}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Coûts de livraison cumulés</p>
          <p className="text-xl font-black text-slate-900 mt-1">{totalShippingCost.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Coût moyen par colis</p>
          <p className="text-xl font-black text-indigo-600 mt-1">{averageShippingCost.toFixed(2)} DH</p>
        </div>

      </div>

      {/* 3. Search Panel */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par client, n° commande, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 w-full text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Transporteur :</span>
          <select
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            className="border border-slate-200 rounded-lg text-xs p-2 focus:outline-hidden"
          >
            <option value="all">Tous</option>
            <option value="colissimo">Colissimo</option>
            <option value="dhl">DHL Express</option>
            <option value="relay">Mondial Relay</option>
            <option value="chronopost">Chronopost</option>
          </select>
        </div>
      </div>

      {/* 4. Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">N° Commande</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Adresse & Ville</th>
                <th className="px-5 py-3">Transporteur</th>
                <th className="px-5 py-3 text-right">Frais d'envoi réel (DH)</th>
                <th className="px-5 py-3">État du colis</th>
                <th className="px-5 py-3 text-right">Suivi logistique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    Aucun colis actif trouvé.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((o) => {
                  const currentCarrier = getCarrierName(o.notes);
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4 font-bold text-indigo-600">{o.orderNumber}</td>
                      <td className="px-5 py-4 font-bold text-slate-800">{o.customerName}</td>
                      <td className="px-5 py-4">
                        <p className="text-slate-700 font-medium">{o.address1}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-300" />
                          {o.customerCity}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={currentCarrier}
                          onChange={(e) => handleCarrierChange(o, e.target.value)}
                          className="border border-slate-200 rounded p-1 text-xs font-bold text-slate-700 bg-white"
                        >
                          <option value="Colissimo">Colissimo France</option>
                          <option value="DHL Express">DHL Express</option>
                          <option value="Mondial Relay">Mondial Relay</option>
                          <option value="Chronopost">Chronopost</option>
                          <option value="FedEx">FedEx International</option>
                        </select>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <input
                          type="text"
                          value={o.deliveryCost}
                          onChange={(e) => handleUpdateField(o.id, "deliveryCost", e.target.value)}
                          className="border border-slate-200 rounded p-1 w-16 text-right font-mono font-bold text-xs"
                        />
                        <span className="ml-1 text-slate-500 font-bold">DH</span>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={o.status}
                          onChange={(e) => handleUpdateField(o.id, "status", e.target.value)}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border cursor-pointer ${
                            o.status === "Livrée" || o.status === "Clôturée"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-cyan-100 text-cyan-700 border-cyan-200"
                          }`}
                        >
                          <option value="Confirmée">Confirmée</option>
                          <option value="Envoyée">Envoyée</option>
                          <option value="Livrée">Livrée</option>
                          <option value="Clôturée">Clôturée</option>
                        </select>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => {
                            const newStatus = o.status === "Envoyée" ? "Livrée" : "Envoyée";
                            handleUpdateField(o.id, "status", newStatus);
                          }}
                          className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider cursor-pointer ${
                            o.status === "Envoyée"
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {o.status === "Envoyée" ? "Confirmer Livraison" : "Expédier le colis"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
