import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  RefreshCw,
  Trophy,
  AlertTriangle,
  Store,
  Compass,
  Sparkles
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface BrandSale {
  name: string;
  sales: number;
}

interface CategorySale {
  name: string;
  value: number;
}

interface BestSeller {
  variantId: number;
  sku: string;
  title: string;
  quantitySold: number;
  revenue: number;
}

interface DeadStockItem {
  id: number;
  sku: string;
  title: string;
  stock: number;
  sellingPrice: string;
}

interface ReportData {
  posTotalSales: number;
  posTotalDiscount: number;
  shopifyTotalSales: number;
  totalSales: number;
  brandSales: BrandSale[];
  posProfit: number;
  posMarginPercent: number;
  bestSellers: BestSeller[];
  categorySales: CategorySale[];
  staffPerformance: any[];
  deadStock: DeadStockItem[];
  lowStock: any[];
}

export default function TableauDeBord() {
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderStats, setOrderStats] = useState({
    total: 0,
    livree: 0,
    envoyee: 0,
    retournee: 0,
    profit: 0
  });

  useEffect(() => {
    fetchReport();
    fetchOrderStats();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/reports/dashboard");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderStats = async () => {
    try {
      const res = await fetchWithAuth("/api/shopify/orders");
      if (res.ok) {
        const list = await res.json();
        const stats = {
          total: list.length,
          livree: list.filter((o: any) => o.status === "Livrée" || o.status === "Clôturée").length,
          envoyee: list.filter((o: any) => o.status === "Envoyée").length,
          retournee: list.filter((o: any) => o.status === "Retournée").length,
          profit: list.reduce((acc: number, o: any) => {
            const tot = parseFloat(o.totalPrice || "0");
            const pur = parseFloat(o.purchasePrice || "0");
            const del = parseFloat(o.deliveryCost || "0");
            const extra = parseFloat(o.extraFees || "0");
            return acc + (tot - pur - del - extra);
          }, 0)
        };
        setOrderStats(stats);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-2">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-xs font-semibold uppercase tracking-wider">Chargement des données analytiques...</p>
      </div>
    );
  }

  const COLORS = ["#6366f1", "#a855f7", "#f97316", "#f59e0b", "#10b981", "#ec4899"];

  // Custom visual list format for brands to match the requested 4 brands + POS
  const brandData = [
    { name: "Magijouets", sales: data.brandSales.find(b => b.name.toLowerCase() === "magijouets")?.sales || 0, color: "#0284c7" },
    { name: "Libijouets", sales: data.brandSales.find(b => b.name.toLowerCase() === "libijouets")?.sales || 0, color: "#7c3aed" },
    { name: "Allez Jouets", sales: data.brandSales.find(b => b.name.toLowerCase() === "allez_jouets" || b.name.toLowerCase() === "allez jouets")?.sales || 0, color: "#ea580c" },
    { name: "Kids Heaven", sales: data.brandSales.find(b => b.name.toLowerCase() === "kids_heaven" || b.name.toLowerCase() === "kids heaven")?.sales || 0, color: "#d97706" },
    { name: "Ventes Caisse POS", sales: data.posTotalSales || 0, color: "#4f46e5" }
  ].filter(b => b.sales > 0);

  const totalRevenue = data.totalSales;

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      
      {/* 1. HERO TITLE */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
        <div>
          <h2 className="text-xl font-black text-slate-900">Tableau de Bord Opérationnel</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Vue générale multi-boutiques & Caisse physique</p>
        </div>
        <button
          onClick={() => { fetchReport(); fetchOrderStats(); }}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-2 rounded-lg flex items-center space-x-1 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualiser les métriques</span>
        </button>
      </div>

      {/* 2. DYNAMIC KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Chiffre d’Affaires Cumulé</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{(totalRevenue).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">
              Caisse: {data.posTotalSales.toFixed(0)} DH | En ligne: {data.shopifyTotalSales.toFixed(0)} DH
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Bénéfice Net Global</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{(data.posProfit + orderStats.profit).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
            <p className="text-[10px] text-emerald-500 mt-1 font-extrabold uppercase">
              Marge moyenne: {totalRevenue > 0 ? (((data.posProfit + orderStats.profit) / totalRevenue) * 100).toFixed(0) : 0}%
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Taux de retours clients</p>
            <p className="text-2xl font-black text-purple-700 mt-1">
              {orderStats.total > 0 ? ((orderStats.retournee / orderStats.total) * 100).toFixed(1) : 0} %
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">
              {orderStats.retournee} retours enregistrés
            </p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Alertes de Stock Bas</p>
            <p className="text-2xl font-black text-rose-600 mt-1">{data.lowStock.length}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">
              Références à réapprovisionner
            </p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* 3. CHART SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Brand Breakdown bar chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Chiffre d’affaires par marque & canal</h3>
          <div className="h-72 w-full text-xs">
            {brandData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">Aucune vente enregistrée</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={brandData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip formatter={(value) => [`${parseFloat(value as string).toFixed(2)} DH`, "Ventes"]} />
                  <Bar dataKey="sales" radius={[8, 8, 0, 0]}>
                    {brandData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Product categories Pie chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Répartition par catégorie</h3>
          <div className="h-72 w-full text-xs flex flex-col justify-between">
            <div className="h-52 w-full">
              {data.categorySales.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categorySales}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {data.categorySales.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} unités`, "Vendues"]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            
            {/* Pie Legends */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {data.categorySales.slice(0, 4).map((entry, index) => (
                <div key={entry.name} className="flex items-center space-x-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-slate-600 truncate font-semibold">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* 4. BEST SELLERS & ALERT LOGS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Best sellers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Meilleures ventes de jouets</h3>
          </div>
          
          <div className="divide-y divide-slate-100">
            {data.bestSellers.length === 0 ? (
              <p className="py-6 text-center text-slate-400">Aucun produit vendu pour le moment.</p>
            ) : (
              data.bestSellers.slice(0, 5).map((p, idx) => (
                <div key={p.sku} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 font-extrabold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate max-w-[220px]">{p.title}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">SKU : {p.sku}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-slate-800">{p.quantitySold} vendus</p>
                    <p className="text-[10px] text-slate-400">{parseFloat(p.revenue.toString()).toFixed(2)} DH</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Operational Indicators */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Compass className="w-5 h-5 text-indigo-500" />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Canaux Opérationnels</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">Commandes En Ligne Shopify</span>
                  <span className="text-slate-900">{orderStats.total}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${orderStats.total > 0 ? 100 : 0}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">Commandes Livrées / Clôturées</span>
                  <span className="text-emerald-600">{orderStats.livree} ({orderStats.total > 0 ? ((orderStats.livree / orderStats.total) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${orderStats.total > 0 ? (orderStats.livree / orderStats.total) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">Retours & Anomalies d’expédition</span>
                  <span className="text-purple-600">{orderStats.retournee} ({orderStats.total > 0 ? ((orderStats.retournee / orderStats.total) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: `${orderStats.total > 0 ? (orderStats.retournee / orderStats.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-tr from-indigo-900 to-indigo-800 text-white rounded-xl p-3.5 mt-5 text-xs flex items-center justify-between shadow-md">
            <div>
              <p className="font-extrabold flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Optimisation Opérationnelle Active
              </p>
              <p className="text-[10px] text-indigo-200 mt-1 leading-relaxed">Les commandes Shopify sont synchronisées en temps réel.</p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-700/60 px-2 py-0.5 rounded-md border border-indigo-600">V3.1.2</span>
          </div>
        </div>

      </div>

    </div>
  );
}
