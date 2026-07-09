import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  FileText,
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  Percent,
  Coins,
  ShieldCheck,
  Scale,
  Calendar
} from "lucide-react";

interface ShopifyOrder {
  id: number;
  shopifyOrderId: string;
  orderNumber: string;
  brand: string;
  customerName: string | null;
  totalPrice: string | null;
  status: string;
  productTitle: string | null;
  deliveryCost: string;
  purchasePrice: string;
  extraFees: string;
  cloturee: string;
  createdAt: string;
}

export default function RapportsBenefices() {
  const { fetchWithAuth } = useAuth();
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // Date Filter State
  const [datePreset, setDatePreset] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/shopify/orders");
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Helper to filter orders based on selected date range
  const getFilteredOrders = () => {
    if (!orders) return [];
    const now = new Date();

    return orders.filter((o) => {
      if (!o.createdAt) return true;
      const orderDate = new Date(o.createdAt);

      if (datePreset === "today") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return orderDate >= startOfToday;
      } else if (datePreset === "yesterday") {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return orderDate >= startOfYesterday && orderDate < endOfYesterday;
      } else if (datePreset === "7days") {
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        return orderDate >= sevenDaysAgo;
      } else if (datePreset === "30days") {
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        return orderDate >= thirtyDaysAgo;
      } else if (datePreset === "thisMonth") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return orderDate >= startOfMonth;
      } else if (datePreset === "custom") {
        let keep = true;
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          keep = keep && orderDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          keep = keep && orderDate <= end;
        }
        return keep;
      }
      return true; // "all"
    });
  };

  const filteredOrders = getFilteredOrders();

  // Group metrics by brand
  const brands = ["magijouets", "libijouets", "allez_jouets", "kids_heaven"];

  const getBrandStats = (brandKey: string) => {
    const brandOrders = filteredOrders.filter(o => o.brand.toLowerCase() === brandKey);
    const revenue = brandOrders.reduce((sum, o) => sum + parseFloat(o.totalPrice || "0"), 0);
    const purchaseCost = brandOrders.reduce((sum, o) => sum + parseFloat(o.purchasePrice || "0"), 0);
    const deliveryCost = brandOrders.reduce((sum, o) => sum + parseFloat(o.deliveryCost || "0"), 0);
    const extraFees = brandOrders.reduce((sum, o) => sum + parseFloat(o.extraFees || "0"), 0);
    const profit = revenue - purchaseCost - deliveryCost - extraFees;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    
    const countTotal = brandOrders.length;
    const countReturned = brandOrders.filter(o => o.status === "Retournée").length;
    const returnRate = countTotal > 0 ? (countReturned / countTotal) * 100 : 0;

    return {
      key: brandKey,
      name: brandKey === "allez_jouets" ? "Allez Jouets" : brandKey === "kids_heaven" ? "Kids Heaven" : brandKey.charAt(0).toUpperCase() + brandKey.slice(1),
      countTotal,
      revenue,
      purchaseCost,
      deliveryCost,
      extraFees,
      profit,
      margin,
      returnRate
    };
  };

  const brandLedgers = brands.map(getBrandStats);

  // Global aggregate metrics
  const totalRevenue = brandLedgers.reduce((sum, b) => sum + b.revenue, 0);
  const totalPurchaseCost = brandLedgers.reduce((sum, b) => sum + b.purchaseCost, 0);
  const totalDeliveryCost = brandLedgers.reduce((sum, b) => sum + b.deliveryCost, 0);
  const totalExtraFees = brandLedgers.reduce((sum, b) => sum + b.extraFees, 0);
  const totalProfit = totalRevenue - totalPurchaseCost - totalDeliveryCost - totalExtraFees;
  const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const exportReport = () => {
    const headers = ["Marque", "Commandes", "Chiffre d’affaires", "Frais d’achat", "Frais de livraison", "Frais additionnels", "Bénéfice Net", "Marge opérationnelle (%)", "Taux de retour (%)"];
    const rows = [headers.join(",")];
    brandLedgers.forEach(b => {
      rows.push([
        b.name,
        b.countTotal,
        b.revenue.toFixed(2),
        b.purchaseCost.toFixed(2),
        b.deliveryCost.toFixed(2),
        b.extraFees.toFixed(2),
        b.profit.toFixed(2),
        b.margin.toFixed(1),
        b.returnRate.toFixed(1)
      ].join(","));
    });
    // Add Total row
    rows.push([
      "TOTAL GENERAL",
      filteredOrders.length,
      totalRevenue.toFixed(2),
      totalPurchaseCost.toFixed(2),
      totalDeliveryCost.toFixed(2),
      totalExtraFees.toFixed(2),
      totalProfit.toFixed(2),
      averageMargin.toFixed(1),
      ((filteredOrders.filter(o => o.status === "Retournée").length / (filteredOrders.length || 1)) * 100).toFixed(1)
    ].join(","));

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Magicaise_Rapport_Financier_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in print:p-0">
      
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0 print:hidden">
        <div>
          <h2 className="text-xl font-black text-slate-900">Rapports Financiers & Bénéfices</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Synthèse de rentabilité analytique par marque</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchOrders}
            className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 cursor-pointer text-slate-500"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={exportReport}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer bg-white"
          >
            <Download className="w-4 h-4" />
            <span>Exporter le grand livre</span>
          </button>
          <button
            onClick={() => window.print()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-100"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer le Rapport</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Période d'analyse</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Filtrer les ventes, coûts et bénéfices par date</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value);
              if (e.target.value !== "custom") {
                setStartDate("");
                setEndDate("");
              }
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-extrabold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">Toutes les dates</option>
            <option value="today">Aujourd'hui</option>
            <option value="yesterday">Hier</option>
            <option value="7days">7 derniers jours</option>
            <option value="30days">30 derniers jours</option>
            <option value="thisMonth">Ce mois-ci</option>
            <option value="custom">Période personnalisée</option>
          </select>

          {datePreset === "custom" && (
            <div className="flex items-center space-x-2 animate-fade-in">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">au</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. SUMMARY METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Chiffre d'affaires global</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalRevenue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
          <div className="flex items-center space-x-1 mt-1.5 text-[10px] font-semibold text-slate-400">
            <Coins className="w-3.5 h-3.5" />
            <span>Total des ventes en ligne Shopify</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Coûts de revient cumulés</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{(totalPurchaseCost + totalDeliveryCost + totalExtraFees).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
          <div className="flex items-center space-x-1 mt-1.5 text-[10px] font-semibold text-rose-400">
            <Scale className="w-3.5 h-3.5" />
            <span>Achat: {totalPurchaseCost.toFixed(0)} DH | Expédition: {totalDeliveryCost.toFixed(0)} DH</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-100 bg-emerald-50/10 shadow-xs">
          <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Bénéfice Net global</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{totalProfit.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
          <div className="flex items-center space-x-1 mt-1.5 text-[10px] font-black text-emerald-500 uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Rentabilité globale positive</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Marge moyenne globale</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{averageMargin.toFixed(1)} %</p>
          <div className="flex items-center space-x-1 mt-1.5 text-[10px] font-semibold text-slate-400">
            <Percent className="w-3.5 h-3.5 text-indigo-500" />
            <span>Sur l'ensemble des 4 boutiques</span>
          </div>
        </div>

      </div>

      {/* 3. BRAND BY BRAND COMPARISON LEDGER */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Grand livre de rentabilité des marques</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-slate-50/50 border-b border-slate-100 font-extrabold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Marque</th>
                <th className="px-6 py-3.5 text-center">Colis vendus</th>
                <th className="px-6 py-3.5 text-right">Chiffre d’affaires (DH)</th>
                <th className="px-6 py-3.5 text-right">Frais d'achat (DH)</th>
                <th className="px-6 py-3.5 text-right">Frais de Livraison (DH)</th>
                <th className="px-6 py-3.5 text-right">Frais Supplémentaires (DH)</th>
                <th className="px-6 py-3.5 text-right">Bénéfice Net Estimé (DH)</th>
                <th className="px-6 py-3.5 text-right">Marge Opérationnelle (%)</th>
                <th className="px-6 py-3.5 text-right">Taux de retours (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {brandLedgers.map((b) => (
                <tr key={b.key} className="hover:bg-slate-50/40">
                  <td className="px-6 py-4">
                    <span className="font-extrabold text-slate-900 block text-xs">{b.name}</span>
                    <span className="text-[9px] text-indigo-500 uppercase font-bold">Boutique Shopify</span>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-800">{b.countTotal}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{b.revenue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
                  <td className="px-6 py-4 text-right font-mono text-rose-600">- {b.purchaseCost.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
                  <td className="px-6 py-4 text-right font-mono text-rose-600">- {b.deliveryCost.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
                  <td className="px-6 py-4 text-right font-mono text-rose-600">- {b.extraFees.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
                  <td className="px-6 py-4 text-right font-mono font-extrabold text-emerald-600">{b.profit.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-0.5 rounded-sm font-extrabold text-[11px] ${b.margin >= 35 ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}>
                      {b.margin.toFixed(1)} %
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono text-[11px] ${b.returnRate > 10 ? "text-rose-600 font-bold" : "text-slate-400"}`}>
                      {b.returnRate.toFixed(1)} %
                    </span>
                  </td>
                </tr>
              ))}

              {/* Total row */}
              <tr className="bg-slate-100/70 font-black border-t-2 border-slate-200">
                <td className="px-6 py-4 text-slate-900 text-xs font-black uppercase">Total Général</td>
                <td className="px-6 py-4 text-center text-slate-900">{filteredOrders.length}</td>
                <td className="px-6 py-4 text-right font-mono text-slate-900 text-xs font-black">{totalRevenue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
                <td className="px-6 py-4 text-right font-mono text-rose-700 text-xs font-black">- {totalPurchaseCost.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
                <td className="px-6 py-4 text-right font-mono text-rose-700 text-xs font-black">- {totalDeliveryCost.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
                <td className="px-6 py-4 text-right font-mono text-rose-700 text-xs font-black">- {totalExtraFees.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
                <td className="px-6 py-4 text-right font-mono text-emerald-700 text-xs font-black">{totalProfit.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</td>
                <td className="px-6 py-4 text-right text-xs font-black text-indigo-700">{averageMargin.toFixed(1)} %</td>
                <td className="px-6 py-4 text-right font-mono text-xs font-black text-slate-600">
                  {filteredOrders.length > 0 ? ((filteredOrders.filter(o => o.status === "Retournée").length / filteredOrders.length) * 100).toFixed(1) : 0} %
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. FINANCIAL SIGN-OFF AREA FOR PRINT */}
      <div className="hidden print:block border-t border-slate-300 pt-12 mt-12 text-xs">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Signé par la direction financière</p>
            <div className="border-b border-slate-300 h-16 mt-2" />
          </div>
          <div className="text-right">
            <p className="font-bold">Magicaise HQ - Édité le {new Date().toLocaleDateString()}</p>
            <p className="text-slate-500 mt-1">Données extraites en temps réel.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
