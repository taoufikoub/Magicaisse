import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  Search,
  Download,
  Upload,
  Plus,
  Trash2,
  SlidersHorizontal,
  ChevronRight,
  RefreshCw,
  MoreHorizontal,
  Smartphone,
  Check,
  Send,
  Printer,
  ChevronLeft,
  X,
  FileSpreadsheet
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
  paymentStatus: string;
  fulfillmentStatus: string;
  reservationStatus: string;
  status: string;
  productTitle: string | null;
  deliveryCost: string;
  purchasePrice: string;
  extraFees: string;
  cloturee: string;
  notes: string | null;
  createdAt: string;
}

export default function CommandesSheet() {
  const { fetchWithAuth } = useAuth();
  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filtering & Search states
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterDate, setFilterDate] = useState("all"); // 'all', 'today', '7d', '30d'
  const [filterProduct, setFilterProduct] = useState("all");
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // Editing state (cell key e.g., 'id-field')
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  // Drawer & detail order
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ShopifyOrder | null>(null);
  
  // New Order Modal
  const [newOrderModal, setNewOrderModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    orderNumber: "",
    brand: "magijouets",
    customerName: "",
    customerPhone: "",
    customerCity: "",
    address1: "",
    totalPrice: "59.99",
    status: "Nouvelle",
    productTitle: "LEGO Star Wars Millennium Falcon 75257",
    deliveryCost: "5.90",
    purchasePrice: "35.00",
    extraFees: "0.00",
    cloturee: "non",
    notes: "",
    variantId: "",
    quantity: 1
  });

  // Catalog products for association
  const [localCatalogVariants, setLocalCatalogVariants] = useState<any[]>([]);

  // Import Modal
  const [importModal, setImportModal] = useState(false);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    fetchOrders();
    fetchCatalog();
  }, []);

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
                sku: v.sku,
                costPrice: v.costPrice,
                sellingPrice: v.sellingPrice,
                productTitle: p.title,
                stock: v.stock
              });
            });
          }
        });
        setLocalCatalogVariants(flat);
      }
    } catch (e) {
      console.error("Failed to fetch product catalog:", e);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/shopify/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderField = async (orderId: number, field: string, value: any) => {
    try {
      const res = await fetchWithAuth(`/api/shopify/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        // Update local state directly
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(prev => prev ? { ...prev, [field]: value } : null);
        }
      }
    } catch (e) {
      console.error("Failed to update inline:", e);
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetchWithAuth("/api/shopify/orders/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status })
      });
      if (res.ok) {
        fetchOrders();
        setSelectedIds([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteOrder = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cette commande ?")) return;
    try {
      const res = await fetchWithAuth(`/api/shopify/orders/${id}`, { method: "DELETE" });
      if (res.ok) {
        setOrders(prev => prev.filter(o => o.id !== id));
        if (selectedOrder && selectedOrder.id === id) {
          setDrawerOpen(false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSeedDemoOrders = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/shopify/orders/seed", { method: "POST" });
      if (res.ok) {
        fetchOrders();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth("/api/shopify/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrder)
      });
      if (res.ok) {
        fetchOrders();
        // Also fetch catalog to refresh stock levels
        fetchCatalog();
        setNewOrderModal(false);
        setNewOrder({
          orderNumber: "",
          brand: "magijouets",
          customerName: "",
          customerPhone: "",
          customerCity: "",
          address1: "",
          totalPrice: "59.99",
          status: "Nouvelle",
          productTitle: "LEGO Star Wars Millennium Falcon 75257",
          deliveryCost: "5.90",
          purchasePrice: "35.00",
          extraFees: "0.00",
          cloturee: "non",
          notes: "",
          variantId: "",
          quantity: 1
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportOrders = async () => {
    if (!importText.trim()) return;
    try {
      // Simple parse Tab/Comma Separated values
      const lines = importText.split("\n");
      const headers = lines[0].toLowerCase().split(/[,\t]/);
      
      const parsedRows = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cells = lines[i].split(/[,\t]/);
        
        // Map common columns
        const rowData: any = {};
        headers.forEach((h, idx) => {
          const val = cells[idx]?.trim();
          if (h.includes("client") || h.includes("name") || h.includes("first name")) {
            rowData.customerName = val;
          } else if (h.includes("phone") || h.includes("tel")) {
            rowData.customerPhone = val;
          } else if (h.includes("city") || h.includes("ville")) {
            rowData.customerCity = val;
          } else if (h.includes("address") || h.includes("adresse")) {
            rowData.address1 = val;
          } else if (h.includes("total") || h.includes("price") || h.includes("prix")) {
            rowData.totalPrice = val;
          } else if (h.includes("order") || h.includes("num")) {
            rowData.orderNumber = val;
          } else if (h.includes("product") || h.includes("title") || h.includes("produit")) {
            rowData.productTitle = val;
          } else if (h.includes("delivery") || h.includes("livraison")) {
            rowData.deliveryCost = val;
          } else if (h.includes("achat") || h.includes("purchase") || h.includes("cost")) {
            rowData.purchasePrice = val;
          } else if (h.includes("status") || h.includes("etat") || h.includes("état")) {
            rowData.status = val;
          } else if (h.includes("marque") || h.includes("brand")) {
            rowData.brand = val;
          } else if (h.includes("cloturee") || h.includes("clôturée")) {
            rowData.cloturee = val;
          }
        });

        parsedRows.push(rowData);
      }

      const res = await fetchWithAuth("/api/shopify/orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedRows)
      });
      if (res.ok) {
        fetchOrders();
        setImportModal(false);
        setImportText("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "État", "Marque", "Nom Client", "Adresse", "Téléphone", "Ville", 
      "Prix Total", "Numéro de Commande", "Produit", "Frais de Livraison", 
      "Prix d'achat", "Bénéfice", "Clôturée", "Notes"
    ];
    
    const csvRows = [headers.join(",")];
    
    getFilteredOrders().forEach((o) => {
      const tot = parseFloat(o.totalPrice || "0");
      const pur = parseFloat(o.purchasePrice || "0");
      const del = parseFloat(o.deliveryCost || "0");
      const extra = parseFloat(o.extraFees || "0");
      const benefit = (tot - pur - del - extra).toFixed(2);

      const row = [
        o.status,
        o.brand,
        `"${o.customerName || ""}"`,
        `"${o.address1 || ""}"`,
        `"${o.customerPhone || ""}"`,
        `"${o.customerCity || ""}"`,
        tot,
        o.orderNumber,
        `"${o.productTitle || ""}"`,
        del,
        pur,
        benefit,
        o.cloturee,
        `"${o.notes || ""}"`
      ];
      csvRows.push(row.join(","));
    });
    
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Magicaise_Commandes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get distinct values for filter lists
  const getUniqueCities = () => {
    const cities = orders.map(o => o.customerCity).filter(Boolean) as string[];
    return ["all", ...Array.from(new Set(cities))];
  };

  const getUniqueProducts = () => {
    const titles = orders.map(o => o.productTitle).filter(Boolean) as string[];
    return ["all", ...Array.from(new Set(titles))];
  };

  // Filter core logic
  const getFilteredOrders = () => {
    let result = [...orders];

    if (filterBrand !== "all") {
      result = result.filter(o => o.brand === filterBrand);
    }
    if (filterStatus !== "all") {
      result = result.filter(o => o.status === filterStatus);
    }
    if (filterCity !== "all") {
      result = result.filter(o => o.customerCity === filterCity);
    }
    if (filterProduct !== "all") {
      result = result.filter(o => o.productTitle === filterProduct);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o => 
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.includes(q)) ||
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customerCity && o.customerCity.toLowerCase().includes(q)) ||
        (o.productTitle && o.productTitle.toLowerCase().includes(q))
      );
    }

    if (filterDate !== "all") {
      const now = new Date();
      result = result.filter(o => {
        const oDate = new Date(o.createdAt);
        const diffTime = Math.abs(now.getTime() - oDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (filterDate === "today") return diffDays <= 1;
        if (filterDate === "7d") return diffDays <= 7;
        if (filterDate === "30d") return diffDays <= 30;
        return true;
      });
    }

    return result;
  };

  const filteredData = getFilteredOrders();

  // Metrics
  const totalCount = filteredData.length;
  const countDelivered = filteredData.filter(o => o.status === "Livrée" || o.status === "Clôturée").length;
  const countShipped = filteredData.filter(o => o.status === "Envoyée").length;
  const countReturned = filteredData.filter(o => o.status === "Retournée").length;
  const sumRevenue = filteredData.reduce((acc, o) => acc + parseFloat(o.totalPrice || "0"), 0);
  
  const sumNetProfit = filteredData.reduce((acc, o) => {
    const tot = parseFloat(o.totalPrice || "0");
    const cost = parseFloat(o.purchasePrice || "0");
    const del = parseFloat(o.deliveryCost || "0");
    const extra = parseFloat(o.extraFees || "0");
    return acc + (tot - cost - del - extra);
  }, 0);

  const returnRate = totalCount > 0 ? (countReturned / totalCount) * 100 : 0;
  const countNonClosed = filteredData.filter(o => o.cloturee !== "oui").length;

  // Pagination bounds
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const currentItems = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const startEdit = (cellId: string, currentVal: string) => {
    setEditingCell(cellId);
    setEditValue(currentVal);
  };

  const saveEdit = (orderId: number, field: string) => {
    handleUpdateOrderField(orderId, field, editValue);
    setEditingCell(null);
  };

  const handleCheckboxSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === currentItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentItems.map(item => item.id));
    }
  };

  // Status visual mapping
  const getStatusMeta = (status: string) => {
    switch (status) {
      case "Nouvelle":
        return { label: "Nouvelle", badge: "bg-slate-100 text-slate-700 border-slate-200" };
      case "Confirmée":
        return { label: "Confirmée", badge: "bg-blue-100 text-blue-700 border-blue-200" };
      case "Envoyée":
        return { label: "Envoyée", badge: "bg-cyan-100 text-cyan-700 border-cyan-200" };
      case "Livrée":
        return { label: "Livrée", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" };
      case "Retournée":
        return { label: "Retournée", badge: "bg-purple-100 text-purple-700 border-purple-200" };
      case "Annulée":
        return { label: "Annulée", badge: "bg-rose-100 text-rose-700 border-rose-200" };
      case "Clôturée":
        return { label: "Clôturée", badge: "bg-green-100 text-green-800 border-green-300 font-bold" };
      default:
        return { label: status, badge: "bg-slate-100 text-slate-800" };
    }
  };

  const getBrandMeta = (brand: string) => {
    switch (brand.toLowerCase()) {
      case "magijouets":
        return { label: "Magijouets", style: "text-sky-600 font-extrabold" };
      case "libijouets":
        return { label: "Libijouets", style: "text-purple-600 font-extrabold" };
      case "allez_jouets":
        return { label: "Allez Jouets", style: "text-orange-600 font-extrabold" };
      case "kids_heaven":
        return { label: "Kids Heaven", style: "text-amber-600 font-extrabold" };
      default:
        return { label: brand, style: "text-slate-600 font-bold" };
    }
  };

  return (
    <div className="flex flex-col space-y-6 h-full min-h-0 text-slate-800">
      
      {/* 1. TOP DYNAMIC METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-8 gap-3">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Commandes</p>
          <p className="text-xl font-black text-slate-800 mt-1">{totalCount}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Livré / Clôturé</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{countDelivered}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">En cours d'envoi</p>
          <p className="text-xl font-black text-blue-500 mt-1">{countShipped}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Commandes Retournées</p>
          <p className="text-xl font-black text-purple-600 mt-1">{countReturned}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-xs lg:col-span-2 bg-gradient-to-tr from-indigo-50/20 to-white">
          <p className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Chiffre d’affaires</p>
          <p className="text-xl font-black text-indigo-900 mt-1">{sumRevenue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs lg:col-span-2 bg-gradient-to-tr from-emerald-50/20 to-white">
          <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Bénéfice Net Estimé</p>
          <p className="text-xl font-black text-emerald-700 mt-1">{sumNetProfit.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} DH</p>
          <p className="text-[9px] text-emerald-500/80 font-bold mt-1">Marge: {sumRevenue > 0 ? ((sumNetProfit/sumRevenue)*100).toFixed(0) : 0}%</p>
        </div>
      </div>

      {/* 2. ACTIONS & FILTERS ROW */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col space-y-3 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Left: Search & Filter widgets */}
        <div className="flex flex-wrap items-center gap-2">
          
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Recherche client, tel, ville, commande..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="border border-slate-200 rounded-lg text-xs p-2 focus:outline-hidden"
          >
            <option value="all">Toutes marques</option>
            <option value="magijouets">Magijouets</option>
            <option value="libijouets">Libijouets</option>
            <option value="allez_jouets">Allez Jouets</option>
            <option value="kids_heaven">Kids Heaven</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-lg text-xs p-2 focus:outline-hidden"
          >
            <option value="all">Tous les états</option>
            <option value="Nouvelle">Nouvelle</option>
            <option value="Confirmée">Confirmée</option>
            <option value="Envoyée">Envoyée</option>
            <option value="Livrée">Livrée</option>
            <option value="Retournée">Retournée</option>
            <option value="Annulée">Annulée</option>
            <option value="Clôturée">Clôturée</option>
          </select>

          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="border border-slate-200 rounded-lg text-xs p-2 focus:outline-hidden"
          >
            <option value="all">Toutes les villes</option>
            {getUniqueCities().filter(c => c !== "all").map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-slate-200 rounded-lg text-xs p-2 focus:outline-hidden"
          >
            <option value="all">Toutes les dates</option>
            <option value="today">Aujourd'hui</option>
            <option value="7d">Derniers 7 jours</option>
            <option value="30d">Derniers 30 jours</option>
          </select>

          {(search || filterBrand !== "all" || filterStatus !== "all" || filterCity !== "all" || filterDate !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setFilterBrand("all");
                setFilterStatus("all");
                setFilterCity("all");
                setFilterDate("all");
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 bg-rose-50 rounded-lg cursor-pointer"
            >
              Réinitialiser
            </button>
          )}
        </div>

        {/* Right: Operational command buttons */}
        <div className="flex items-center space-x-2 justify-end">
          <button
            onClick={() => setNewOrderModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter Commande</span>
          </button>

          <button
            onClick={() => setImportModal(true)}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
            title="Importer depuis Google Sheets ou CSV"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importer</span>
          </button>

          <button
            onClick={exportToCSV}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
            title="Exporter en CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exporter CSV</span>
          </button>

          <button
            onClick={fetchOrders}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 3. BULK ACTIONS FLOATING TOOLBAR */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-900 text-white px-5 py-3 rounded-xl flex items-center justify-between shadow-lg animate-fade-in z-20">
          <div className="flex items-center space-x-3">
            <span className="bg-indigo-700 text-[10px] uppercase font-black px-2.5 py-1 rounded-full">{selectedIds.length} Sélectionnée(s)</span>
            <p className="text-xs font-medium">Appliquer des actions en bloc sur ces lignes :</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusUpdate(e.target.value);
                  e.target.value = "";
                }
              }}
              className="bg-white/15 hover:bg-white/20 border border-white/20 rounded-lg text-xs p-1.5 focus:outline-hidden text-white"
            >
              <option value="" className="text-slate-800">Changer l'état...</option>
              <option value="Nouvelle" className="text-slate-800">Nouvelle</option>
              <option value="Confirmée" className="text-slate-800">Confirmée</option>
              <option value="Envoyée" className="text-slate-800">Envoyée</option>
              <option value="Livrée" className="text-slate-800">Livrée</option>
              <option value="Retournée" className="text-slate-800">Retournée</option>
              <option value="Annulée" className="text-slate-800">Annulée</option>
              <option value="Clôturée" className="text-slate-800">Clôturée</option>
            </select>

            <button
              onClick={() => {
                if(confirm(`Supprimer ces ${selectedIds.length} commandes définitivement ?`)) {
                  selectedIds.forEach(id => {
                    fetchWithAuth(`/api/shopify/orders/${id}`, { method: "DELETE" });
                  });
                  setTimeout(() => {
                    fetchOrders();
                    setSelectedIds([]);
                  }, 500);
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="text-white/70 hover:text-white text-xs px-2 cursor-pointer"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {orders.length === 0 && !loading && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-xl text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider">Base de données de commandes vide</h4>
            <p className="text-xs text-indigo-100 mt-1">
              Vous pouvez ajouter des commandes manuellement en utilisant le bouton ci-dessus, ou charger 16 commandes de démonstration réalistes pour tester les rapports financiers et l'interface.
            </p>
          </div>
          <button
            onClick={handleSeedDemoOrders}
            className="bg-white hover:bg-indigo-50 text-indigo-700 font-extrabold text-xs px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Générer 16 commandes démo</span>
          </button>
        </div>
      )}

      {/* 4. SPREADSHEET MAIN CONTAINER */}
      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
        
        {/* Table layout - Desktop */}
        <div className="flex-1 overflow-auto max-w-full">
          <table className="min-w-full border-collapse text-left text-xs">
            
            {/* Sticky headers */}
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={currentItems.length > 0 && selectedIds.length === currentItems.length}
                    onChange={handleSelectAll}
                    className="rounded text-indigo-600"
                  />
                </th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-28">État</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-28">Marque</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider">Client (Double-clic)</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider">Adresse</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-32">Téléphone</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-28">Ville</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-24">Prix Total</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-24">N° Commande</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider">Titre Produit</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-20">Livraison</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-20">Achat</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-20">Bénéfice</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-20">Clôturée</th>
                <th className="px-4 py-3 font-extrabold text-slate-500 uppercase tracking-wider w-16 text-right">Actions</th>
              </tr>
            </thead>

            {/* Scrollable Rows */}
            <tbody className="divide-y divide-slate-100">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400 font-medium">
                    Aucune commande trouvée avec les filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                currentItems.map((o) => {
                  const isChecked = selectedIds.includes(o.id);
                  const statusMeta = getStatusMeta(o.status);
                  const brandMeta = getBrandMeta(o.brand);

                  // Calculation logic on the fly
                  const tot = parseFloat(o.totalPrice || "0");
                  const pur = parseFloat(o.purchasePrice || "0");
                  const del = parseFloat(o.deliveryCost || "0");
                  const extra = parseFloat(o.extraFees || "0");
                  const benefit = tot - pur - del - extra;

                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-indigo-50/15 transition-all border-l-4 ${
                        o.status === "Clôturée"
                          ? "border-l-green-600 bg-green-50/10"
                          : o.status === "Annulée"
                          ? "border-l-rose-500 bg-rose-50/10"
                          : o.status === "Livrée"
                          ? "border-l-emerald-500"
                          : "border-l-transparent"
                      }`}
                    >
                      {/* Selection Box */}
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxSelect(o.id)}
                          className="rounded text-indigo-600 cursor-pointer"
                        />
                      </td>

                      {/* État colored dropdown selector */}
                      <td className="px-3 py-2.5">
                        <select
                          value={o.status}
                          onChange={(e) => handleUpdateOrderField(o.id, "status", e.target.value)}
                          className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase border cursor-pointer w-full focus:outline-hidden ${statusMeta.badge}`}
                        >
                          <option value="Nouvelle">Nouvelle</option>
                          <option value="Confirmée">Confirmée</option>
                          <option value="Envoyée">Envoyée</option>
                          <option value="Livrée">Livrée</option>
                          <option value="Retournée">Retournée</option>
                          <option value="Annulée">Annulée</option>
                          <option value="Clôturée">Clôturée</option>
                        </select>
                      </td>

                      {/* Brand Label */}
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] uppercase font-black tracking-wide ${brandMeta.style}`}>
                          {brandMeta.label}
                        </span>
                      </td>

                      {/* Customer Name (Inline text edit) */}
                      <td
                        onDoubleClick={() => startEdit(`${o.id}-customerName`, o.customerName || "")}
                        className="px-4 py-2.5 font-bold text-slate-800 cursor-pointer hover:bg-slate-50 min-w-[140px]"
                      >
                        {editingCell === `${o.id}-customerName` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(o.id, "customerName")}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(o.id, "customerName")}
                            className="border border-indigo-400 p-1 w-full text-xs rounded-sm focus:outline-hidden bg-white"
                            autoFocus
                          />
                        ) : (
                          <span className="truncate block max-w-[150px]">{o.customerName || "—"}</span>
                        )}
                      </td>

                      {/* Address 1 (Inline text edit) */}
                      <td
                        onDoubleClick={() => startEdit(`${o.id}-address1`, o.address1 || "")}
                        className="px-4 py-2.5 text-slate-500 cursor-pointer hover:bg-slate-50 min-w-[180px]"
                      >
                        {editingCell === `${o.id}-address1` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(o.id, "address1")}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(o.id, "address1")}
                            className="border border-indigo-400 p-1 w-full text-xs rounded-sm focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <span className="truncate block max-w-[200px]">{o.address1 || "—"}</span>
                        )}
                      </td>

                      {/* Customer Phone (Inline edit) */}
                      <td
                        onDoubleClick={() => startEdit(`${o.id}-customerPhone`, o.customerPhone || "")}
                        className="px-4 py-2.5 font-mono text-[11px] cursor-pointer hover:bg-slate-50"
                      >
                        {editingCell === `${o.id}-customerPhone` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(o.id, "customerPhone")}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(o.id, "customerPhone")}
                            className="border border-indigo-400 p-1 w-full text-xs rounded-sm focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <span>{o.customerPhone || "—"}</span>
                        )}
                      </td>

                      {/* City (Inline edit) */}
                      <td
                        onDoubleClick={() => startEdit(`${o.id}-customerCity`, o.customerCity || "")}
                        className="px-4 py-2.5 cursor-pointer hover:bg-slate-50"
                      >
                        {editingCell === `${o.id}-customerCity` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(o.id, "customerCity")}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(o.id, "customerCity")}
                            className="border border-indigo-400 p-1 w-full text-xs rounded-sm focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <span>{o.customerCity || "—"}</span>
                        )}
                      </td>

                      {/* Total Price (Inline edit) */}
                      <td
                        onDoubleClick={() => startEdit(`${o.id}-totalPrice`, o.totalPrice || "")}
                        className="px-4 py-2.5 font-bold text-slate-800 cursor-pointer hover:bg-slate-50 text-right"
                      >
                        {editingCell === `${o.id}-totalPrice` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(o.id, "totalPrice")}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(o.id, "totalPrice")}
                            className="border border-indigo-400 p-1 w-full text-xs rounded-sm focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <span>{tot.toFixed(2)} DH</span>
                        )}
                      </td>

                      {/* Order Number (Inline edit) */}
                      <td
                        onDoubleClick={() => startEdit(`${o.id}-orderNumber`, o.orderNumber || "")}
                        className="px-4 py-2.5 font-bold text-indigo-600 cursor-pointer hover:bg-slate-50"
                      >
                        {editingCell === `${o.id}-orderNumber` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(o.id, "orderNumber")}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(o.id, "orderNumber")}
                            className="border border-indigo-400 p-1 w-full text-xs rounded-sm focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <span>{o.orderNumber}</span>
                        )}
                      </td>

                      {/* Product Title (Inline edit) */}
                      <td
                        onDoubleClick={() => startEdit(`${o.id}-productTitle`, o.productTitle || "")}
                        className="px-4 py-2.5 font-medium text-slate-700 cursor-pointer hover:bg-slate-50 min-w-[160px]"
                      >
                        {editingCell === `${o.id}-productTitle` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(o.id, "productTitle")}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(o.id, "productTitle")}
                            className="border border-indigo-400 p-1 w-full text-xs rounded-sm focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <span className="truncate block max-w-[180px]">{o.productTitle || "—"}</span>
                        )}
                      </td>

                      {/* Delivery cost (Inline edit) */}
                      <td
                        onDoubleClick={() => startEdit(`${o.id}-deliveryCost`, o.deliveryCost || "")}
                        className="px-4 py-2.5 cursor-pointer hover:bg-slate-50 text-right"
                      >
                        {editingCell === `${o.id}-deliveryCost` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(o.id, "deliveryCost")}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(o.id, "deliveryCost")}
                            className="border border-indigo-400 p-1 w-full text-xs rounded-sm focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <span>{del.toFixed(2)} DH</span>
                        )}
                      </td>

                      {/* Purchase price (Inline edit) */}
                      <td
                        onDoubleClick={() => startEdit(`${o.id}-purchasePrice`, o.purchasePrice || "")}
                        className="px-4 py-2.5 cursor-pointer hover:bg-slate-50 text-right"
                      >
                        {editingCell === `${o.id}-purchasePrice` ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(o.id, "purchasePrice")}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(o.id, "purchasePrice")}
                            className="border border-indigo-400 p-1 w-full text-xs rounded-sm focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <span>{pur.toFixed(2)} DH</span>
                        )}
                      </td>

                      {/* Net Benefit (Dynamic output) */}
                      <td className={`px-4 py-2.5 font-extrabold text-right ${benefit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        <span>{benefit.toFixed(2)} DH</span>
                      </td>

                      {/* Clôturée Status selector */}
                      <td className="px-4 py-2.5">
                        <select
                          value={o.cloturee}
                          onChange={(e) => handleUpdateOrderField(o.id, "cloturee", e.target.value)}
                          className={`text-[11px] font-bold p-1 rounded-sm border cursor-pointer ${
                            o.cloturee === "oui"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-amber-100 text-amber-700 border-amber-200"
                          }`}
                        >
                          <option value="non">Non</option>
                          <option value="oui">Oui</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5 text-right flex items-center justify-end space-x-1">
                        <button
                          onClick={() => {
                            setSelectedOrder(o);
                            setDrawerOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          title="Ouvrir le panneau"
                        >
                          <ChevronRight className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(o.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Supprimer la commande"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. TABLE FOOTER & PAGINATION */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-500 font-medium">
            <span>Affichage de {currentItems.length} sur {filteredData.length} lignes filtrées</span>
            {selectedIds.length > 0 && (
              <span className="text-indigo-600">({selectedIds.length} sélectionnée(s))</span>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center space-x-1 text-xs font-bold">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${
                    currentPage === p
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 6. RIGHT DRAWER DETAIL SLIDE-OUT PANEL */}
      {drawerOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden text-slate-800">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300" onClick={() => setDrawerOpen(false)} />
          
          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-md bg-white flex flex-col shadow-2xl h-full p-6 animate-slide-in relative border-l border-slate-100">
              
              {/* Close button */}
              <button
                onClick={() => setDrawerOpen(false)}
                className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                
                {/* Header info */}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full ${getStatusMeta(selectedOrder.status).badge}`}>
                      {selectedOrder.status}
                    </span>
                    <span className="text-slate-400 text-xs font-mono">{selectedOrder.orderNumber}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-2">{selectedOrder.customerName}</h3>
                  <p className="text-xs text-indigo-600 font-extrabold uppercase mt-0.5 tracking-wider">{getBrandMeta(selectedOrder.brand).label}</p>
                </div>

                {/* Core operational status quick buttons */}
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Actions de suivi rapide</p>
                  
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleUpdateOrderField(selectedOrder.id, "status", "Envoyée")}
                      className="px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-[10px] rounded-lg border border-sky-100 uppercase tracking-wider text-center cursor-pointer"
                    >
                      Marquer Envoyée
                    </button>
                    <button
                      onClick={() => handleUpdateOrderField(selectedOrder.id, "status", "Livrée")}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[10px] rounded-lg border border-emerald-100 uppercase tracking-wider text-center cursor-pointer"
                    >
                      Marquer Livrée
                    </button>
                    <button
                      onClick={() => handleUpdateOrderField(selectedOrder.id, "status", "Retournée")}
                      className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-[10px] rounded-lg border border-purple-100 uppercase tracking-wider text-center cursor-pointer"
                    >
                      Marquer Retournée
                    </button>
                    <button
                      onClick={() => {
                        handleUpdateOrderField(selectedOrder.id, "status", "Clôturée");
                        handleUpdateOrderField(selectedOrder.id, "cloturee", "oui");
                      }}
                      className="px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 font-black text-[10px] rounded-lg uppercase tracking-wider text-center cursor-pointer"
                    >
                      Clôturer la commande
                    </button>
                  </div>
                </div>

                {/* Client Contact & Address details */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Informations Client</h4>
                  
                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 space-y-3 text-xs">
                    <div>
                      <p className="text-slate-400 font-medium">Adresse complète</p>
                      <p className="font-bold text-slate-800 mt-1">{selectedOrder.address1 || "—"}</p>
                      <p className="font-bold text-slate-800">{selectedOrder.customerCity}</p>
                    </div>

                    <div>
                      <p className="text-slate-400 font-medium">Téléphone</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono font-bold text-slate-800">{selectedOrder.customerPhone || "—"}</span>
                        
                        {selectedOrder.customerPhone && (
                          <a
                            href={`https://wa.me/${selectedOrder.customerPhone.replace(/[\s+]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] px-2.5 py-1 rounded-md flex items-center space-x-1 uppercase tracking-wider"
                          >
                            <Send className="w-3 h-3 fill-white" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product Detail items */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Produits de la commande</h4>
                  
                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-xs truncate max-w-[240px]">{selectedOrder.productTitle}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Quantité : 1 pièce</p>
                      </div>
                      <span className="text-xs font-black text-slate-800">{parseFloat(selectedOrder.totalPrice || "0").toFixed(2)} DH</span>
                    </div>
                  </div>
                </div>

                {/* Profit Math calculations */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider font-extrabold">Calcul de marge & bénéfice</h4>
                  
                  <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Prix de vente total</span>
                      <span className="font-bold">{parseFloat(selectedOrder.totalPrice || "0").toFixed(2)} DH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Prix d’achat (Fournisseur)</span>
                      <span className="font-bold text-rose-600">- {parseFloat(selectedOrder.purchasePrice || "0").toFixed(2)} DH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Frais de livraison</span>
                      <span className="font-bold text-rose-600">- {parseFloat(selectedOrder.deliveryCost || "0").toFixed(2)} DH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Frais supplémentaires</span>
                      <span className="font-bold text-rose-600">- {parseFloat(selectedOrder.extraFees || "0").toFixed(2)} DH</span>
                    </div>
                    
                    <div className="border-t border-slate-200 my-2 pt-2 flex justify-between">
                      <span className="font-black text-slate-800">Bénéfice Net Estimé</span>
                      <span className={`font-black text-sm ${(parseFloat(selectedOrder.totalPrice || "0") - parseFloat(selectedOrder.purchasePrice || "0") - parseFloat(selectedOrder.deliveryCost || "0") - parseFloat(selectedOrder.extraFees || "0")) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {(parseFloat(selectedOrder.totalPrice || "0") - parseFloat(selectedOrder.purchasePrice || "0") - parseFloat(selectedOrder.deliveryCost || "0") - parseFloat(selectedOrder.extraFees || "0")).toFixed(2)} DH
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes and Print option */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Commentaires & Notes</h4>
                  </div>
                  
                  <textarea
                    value={selectedOrder.notes || ""}
                    onChange={(e) => handleUpdateOrderField(selectedOrder.id, "notes", e.target.value)}
                    placeholder="Ajouter des détails sur la livraison, contact, préférences..."
                    className="w-full text-xs border border-slate-200 rounded-xl p-3 h-20 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Print Receipt Receipt Button */}
                <button
                  onClick={() => {
                    alert("Préparation du bordereau d'expédition de commande : " + selectedOrder.orderNumber + "\nLancer l'impression...");
                    window.print();
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer le Bordereau d’Expédition</span>
                </button>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. NEW ORDER CREATION MODAL */}
      {newOrderModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center text-slate-800">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setNewOrderModal(false)} />
          
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 z-10 relative border border-slate-100">
            <button
              onClick={() => setNewOrderModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 mb-4">
              Créer une Commande de Vente Manuelle
            </h3>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Numéro Commande</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: #MJ-1051"
                    value={newOrder.orderNumber}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, orderNumber: e.target.value }))}
                    className="w-full border border-slate-200 p-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Marque</label>
                  <select
                    value={newOrder.brand}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, brand: e.target.value }))}
                    className="w-full border border-slate-200 p-2 rounded-lg"
                  >
                    <option value="magijouets">Magijouets</option>
                    <option value="libijouets">Libijouets</option>
                    <option value="allez_jouets">Allez Jouets</option>
                    <option value="kids_heaven">Kids Heaven</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-bold uppercase mb-1">Nom Complet Client</label>
                <input
                  type="text"
                  required
                  placeholder="Nom du client"
                  value={newOrder.customerName}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full border border-slate-200 p-2 rounded-lg"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 space-y-3">
                <p className="font-bold text-[10px] uppercase text-indigo-700 tracking-wider">Association Catalogue Stock (Déduction Stock automatique)</p>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-slate-500 font-bold uppercase mb-1">Sélectionner un Article</label>
                    <select
                      value={newOrder.variantId || ""}
                      onChange={(e) => {
                        const vId = e.target.value;
                        if (!vId) {
                          setNewOrder(prev => ({
                            ...prev,
                            variantId: "",
                            productTitle: "",
                            totalPrice: "0.00",
                            purchasePrice: "0.00"
                          }));
                        } else {
                          const matched = localCatalogVariants.find(v => String(v.variantId) === String(vId));
                          if (matched) {
                            setNewOrder(prev => ({
                              ...prev,
                              variantId: String(vId),
                              productTitle: matched.productTitle,
                              totalPrice: String(matched.sellingPrice || "0"),
                              purchasePrice: String(matched.costPrice || "0")
                            }));
                          }
                        }
                      }}
                      className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                    >
                      <option value="">-- Saisie libre (Sans déduction de stock) --</option>
                      {localCatalogVariants.map(v => (
                        <option key={v.variantId} value={v.variantId}>
                          {v.title} (Stock: {v.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold uppercase mb-1">Quantité</label>
                    <input
                      type="number"
                      min={1}
                      value={newOrder.quantity}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="w-full border border-slate-200 p-2 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Prix de vente (DH)</label>
                  <input
                    type="text"
                    value={newOrder.totalPrice}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, totalPrice: e.target.value }))}
                    className="w-full border border-slate-200 p-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase mb-1">Titre du produit vendu</label>
                  <input
                    type="text"
                    placeholder="Nom de l'article"
                    value={newOrder.productTitle}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, productTitle: e.target.value }))}
                    className="w-full border border-slate-200 p-2 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-bold uppercase mb-1">Notes / Instructions</label>
                <textarea
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes importantes de la commande..."
                  className="w-full border border-slate-200 p-2 rounded-lg h-16"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewOrderModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg shadow-sm"
                >
                  Ajouter Ligne de Commande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. BULK IMPORT MODAL */}
      {importModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center text-slate-800">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setImportModal(false)} />
          
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl mx-4 z-10 relative border border-slate-100">
            <button
              onClick={() => setImportModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <span>Importer des Commandes depuis Google Sheets / Excel / CSV</span>
            </h3>
            
            <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
              Collez vos lignes de tableau Google Sheets (avec en-têtes) directement ci-dessous. Le système analysera automatiquement les colonnes : 
              <strong> Order Num, Nom client, Phone, City, Address 1, Total Price, Product Title, Delivery, Prix d'achat, État, Marque</strong>.
            </p>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Order Num	Marque	Nom client	Address 1	Phone	City	Total Price	Product Title	Delivery	Prix d’achat	État	Clôturée
#MJ-1044	magijouets	Julie Lambert	10 Rue Royale	+33 6 00 11 22 33	Paris	59.90	LEGO Star Wars	5.90	35.00	Nouvelle	non"
              className="w-full border border-slate-200 p-3 rounded-lg h-60 font-mono text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />

            <div className="flex justify-end space-x-2 pt-4 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImportModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleImportOrders}
                disabled={!importText.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-lg shadow-sm text-xs cursor-pointer"
              >
                Lancer l'importation de lignes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
