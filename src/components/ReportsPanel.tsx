import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Percent,
  RefreshCw,
  Trophy,
  AlertOctagon,
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

export default function ReportsPanel() {
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
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

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const COLORS = ["#4f46e5", "#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e"];

  return (
    <div className="space-y-6 overflow-y-auto h-full pr-1 text-slate-800">
      {/* KPI Cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Total Revenue
            </span>
            <span className="text-xl font-extrabold text-slate-800">
              ${data.totalSales.toFixed(2)}
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Physical Store Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Physical POS Sales
            </span>
            <span className="text-xl font-extrabold text-slate-800">
              ${data.posTotalSales.toFixed(2)}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Shopify Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Shopify Online Sales
            </span>
            <span className="text-xl font-extrabold text-slate-800">
              ${data.shopifyTotalSales.toFixed(2)}
            </span>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: POS Profit & Margin */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              POS Gross Margin
            </span>
            <span className="text-xl font-extrabold text-slate-800">
              {data.posMarginPercent.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">
              Profit: ${data.posProfit.toFixed(0)}
            </span>
          </div>
          <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
            <Percent className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Graphs row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Graph 1: Sales across channels (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">
            Sales Performance by Brand Storefront
          </span>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.brandSales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [`$${parseFloat(String(value)).toFixed(2)}`, "Sales"]} />
                <Bar dataKey="sales" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Category sales (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">
            POS Sales Share by Toy Category
          </span>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {data.categorySales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categorySales}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.categorySales.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `$${parseFloat(String(v)).toFixed(2)}`} />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" fontSize={10} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-slate-400 font-medium">No sales details to display yet.</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom metrics row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Best Sellers (6 cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center space-x-1.5 border-b border-slate-100 pb-3 mb-3">
            <Trophy className="w-4.5 h-4.5 text-indigo-600" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Best Selling Toys (Multichannel)
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {data.bestSellers.map((toy, idx) => (
              <div key={idx} className="flex justify-between items-center py-2.5">
                <div className="truncate pr-3">
                  <span className="font-bold text-slate-800 truncate block">{toy.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">SKU: {toy.sku}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="font-bold text-slate-800 block">{toy.quantitySold} sold</span>
                  <span className="text-[10px] text-slate-400 font-semibold block">${toy.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {data.bestSellers.length === 0 && (
              <div className="py-8 text-center text-slate-400">No sales aggregated yet.</div>
            )}
          </div>
        </div>

        {/* Column 2: Dead Stock (6 cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center space-x-1.5 border-b border-slate-100 pb-3 mb-3">
            <AlertOctagon className="w-4.5 h-4.5 text-rose-500" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Dead Stock Alerts (0 Sales)
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {data.deadStock.map((toy, idx) => (
              <div key={idx} className="flex justify-between items-center py-2.5">
                <div className="truncate pr-3">
                  <span className="font-bold text-slate-800 truncate block">{toy.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">SKU: {toy.sku}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="font-bold text-rose-600 block">{toy.stock} units sitting</span>
                  <span className="text-[10px] text-slate-400 font-semibold block">Price: ${toy.sellingPrice}</span>
                </div>
              </div>
            ))}
            {data.deadStock.length === 0 && (
              <div className="py-8 text-center text-slate-400">No dead stock alerts.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
