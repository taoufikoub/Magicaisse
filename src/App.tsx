import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./components/AuthContext.tsx";
import LoginScreen from "./components/LoginScreen.tsx";
import POSCheckout from "./components/POSCheckout.tsx";
import ProductCatalog from "./components/ProductCatalog.tsx";
import InventoryManager from "./components/InventoryManager.tsx";
import PurchaseOrders from "./components/PurchaseOrders.tsx";

// New high-fidelity operational pages
import CommandesSheet from "./components/CommandesSheet.tsx";
import TableauDeBord from "./components/TableauDeBord.tsx";
import RetoursTracker from "./components/RetoursTracker.tsx";
import LivraisonsPanel from "./components/LivraisonsPanel.tsx";
import RapportsBenefices from "./components/RapportsBenefices.tsx";
import ShopifyBrandsConnector from "./components/ShopifyBrandsConnector.tsx";
import ParametresSysteme from "./components/ParametresSysteme.tsx";

import {
  Calculator,
  ShoppingBag,
  Bookmark,
  Package,
  Coins,
  Truck,
  TrendingUp,
  Server,
  LogOut,
  User,
  ShieldAlert,
  Menu,
  X,
  RotateCcw,
  Settings,
  FileSpreadsheet
} from "lucide-react";

type Tab =
  | "dashboard"
  | "orders"
  | "catalog"
  | "inventory"
  | "checkout"
  | "po"
  | "retours"
  | "livraison"
  | "reports"
  | "marques"
  | "settings";

function DashboardContent() {
  const { dbUser, logOut, fetchWithAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("orders"); // Defaults to Commandes after login!
  const [activeSession, setActiveSession] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [customAccess, setCustomAccess] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem("toyhub_custom_roles_access");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return {
      dashboard: ["owner", "manager", "accountant"],
      orders: ["owner", "manager", "cashier", "stock manager", "accountant"],
      catalog: ["owner", "manager", "stock manager"],
      inventory: ["owner", "manager", "stock manager"],
      checkout: ["owner", "manager", "cashier", "stock manager", "accountant"],
      po: ["owner", "manager", "stock manager"],
      retours: ["owner", "manager", "cashier", "stock manager"],
      livraison: ["owner", "manager", "stock manager"],
      reports: ["owner", "manager", "accountant"],
      marques: ["owner", "manager", "stock manager"],
      settings: ["owner", "manager"],
    };
  });

  useEffect(() => {
    checkActiveSession();

    const handlePermissionsUpdated = () => {
      try {
        const stored = localStorage.getItem("toyhub_custom_roles_access");
        if (stored) {
          setCustomAccess(JSON.parse(stored));
        }
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener("toyhub-permissions-updated", handlePermissionsUpdated);
    return () => {
      window.removeEventListener("toyhub-permissions-updated", handlePermissionsUpdated);
    };
  }, []);

  const checkActiveSession = async () => {
    try {
      const res = await fetchWithAuth("/api/sales/sessions/active");
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.active ? data.session : null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const menuItems = [
    { id: "dashboard" as Tab, label: "Dashboard", icon: TrendingUp, roles: ["owner", "manager", "accountant"] },
    { id: "orders" as Tab, label: "Commandes", icon: ShoppingBag, roles: ["owner", "manager", "cashier", "stock manager", "accountant"] },
    { id: "catalog" as Tab, label: "Produits", icon: Bookmark, roles: ["owner", "manager", "stock manager"] },
    { id: "inventory" as Tab, label: "Stock", icon: Package, roles: ["owner", "manager", "stock manager"] },
    { id: "checkout" as Tab, label: "POS Caisse", icon: Calculator, roles: ["owner", "manager", "cashier", "stock manager", "accountant"] },
    { id: "po" as Tab, label: "Achats / Prix d’achat", icon: Coins, roles: ["owner", "manager", "stock manager"] },
    { id: "retours" as Tab, label: "Retours", icon: RotateCcw, roles: ["owner", "manager", "cashier", "stock manager"] },
    { id: "livraison" as Tab, label: "Livraison", icon: Truck, roles: ["owner", "manager", "stock manager"] },
    { id: "reports" as Tab, label: "Rapports & Bénéfices", icon: FileSpreadsheet, roles: ["owner", "manager", "accountant"] },
    { id: "marques" as Tab, label: "Marques", icon: Server, roles: ["owner", "manager", "stock manager"] },
    { id: "settings" as Tab, label: "Paramètres", icon: Settings, roles: ["owner", "manager"] },
  ];

  const allowedItems = menuItems.filter((item) => {
    if (!dbUser) return false;
    if (dbUser.role === "owner") return true; // Owners always have universal access to avoid lockouts
    const rolesForTab = customAccess[item.id] || item.roles;
    return rolesForTab.includes(dbUser.role);
  });

  const getRoleLabelFrench = (role: string) => {
    switch (role) {
      case "owner":
        return "Propriétaire";
      case "manager":
        return "Gérant";
      case "cashier":
        return "Caissier";
      case "stock manager":
        return "Gestionnaire de stock";
      case "accountant":
        return "Comptable";
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "manager":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "cashier":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "stock manager":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "accountant":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-800">
      {/* Sidebar Navigation - Desktop */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col justify-between h-full flex-shrink-0 shadow-sm">
        <div className="p-6">
          {/* Logo */}
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h1 className="font-black text-base leading-tight tracking-tight text-slate-800">
                Magicaise <span className="text-indigo-600">HQ</span>
              </h1>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold block mt-0.5">
                Inventaire Maître Partagé
              </p>
            </div>
          </div>

          {/* Navigation Menu Links */}
          <nav className="space-y-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-2">Opérations</div>
            {allowedItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <IconComp className="w-4.5 h-4.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-600 text-white font-black rounded-xl flex items-center justify-center text-sm shadow-md uppercase">
              {dbUser?.name?.charAt(0) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-extrabold text-slate-800 block truncate text-xs">{dbUser?.name}</span>
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border uppercase tracking-wider block w-fit mt-1 ${getRoleBadgeColor(dbUser?.role || "cashier")}`}>
                {getRoleLabelFrench(dbUser?.role || "cashier")}
              </span>
            </div>
          </div>

          <button
            onClick={logOut}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnecter la Session</span>
          </button>
        </div>
      </aside>

      {/* Mobile sliding drawer overlay and sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <aside className="relative flex w-64 max-w-xs flex-col justify-between bg-white h-full shadow-2xl p-6 transition-transform duration-300 ease-in-out">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pt-4">
              {/* Logo */}
              <div className="flex items-center space-x-3 mb-8">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-black text-base leading-tight tracking-tight text-slate-800">
                    Magicaise <span className="text-indigo-600">HQ</span>
                  </h1>
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold block mt-0.5">
                    Inventaire Maître Partagé
                  </p>
                </div>
              </div>

              {/* Navigation Menu Links */}
              <nav className="space-y-1">
                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-2">Opérations</div>
                {allowedItems.map((item) => {
                  const IconComp = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <IconComp className="w-4.5 h-4.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* User Card footer */}
            <div className="pt-6 border-t border-slate-100">
              <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-indigo-600 text-white font-black rounded-xl flex items-center justify-center text-sm shadow-md uppercase">
                  {dbUser?.name?.charAt(0) || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-slate-800 block truncate text-xs">{dbUser?.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border uppercase tracking-wider block w-fit mt-1 ${getRoleBadgeColor(dbUser?.role || "cashier")}`}>
                    {getRoleLabelFrench(dbUser?.role || "cashier")}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logOut();
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Déconnecter la Session</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Container Stage */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar indicators */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 flex-shrink-0">
          <div className="flex items-center space-x-2.5 md:space-x-4">
            {/* Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 -ml-1 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 md:hidden cursor-pointer"
              title="Menu"
            >
              <Menu className="w-5.5 h-5.5" />
            </button>

            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest hidden sm:block">
              Centre de Contrôle
            </h2>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                ● Base synchronisée
              </span>
            </div>
          </div>

          {/* Quick cash sessions and credentials indicators */}
          <div className="flex items-center space-x-2.5 md:space-x-4">
            {activeSession ? (
              <span className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[9px] md:text-[10px] font-extrabold px-2 py-0.5 md:px-3 md:py-1 rounded-full uppercase tracking-wider">
                Caisse : {parseFloat(activeSession.openingCash).toFixed(0)} DH
              </span>
            ) : (
              <span className="bg-rose-50 border border-rose-100 text-rose-800 text-[9px] md:text-[10px] font-extrabold px-2 py-0.5 md:px-3 md:py-1 rounded-full uppercase tracking-wider flex items-center space-x-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden xs:inline">Fermée</span>
              </span>
            )}
            <span className="text-[10px] md:text-xs font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg">
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </header>

        {/* Dynamic Inner Panel View Router */}
        <div className="flex-1 p-3 md:p-6 overflow-y-auto md:overflow-hidden bg-slate-50/40">
          {activeTab === "dashboard" && <TableauDeBord />}
          {activeTab === "orders" && <CommandesSheet />}
          {activeTab === "catalog" && <ProductCatalog />}
          {activeTab === "inventory" && <InventoryManager />}
          {activeTab === "checkout" && (
            <POSCheckout activeSession={activeSession} onRefreshSessions={checkActiveSession} />
          )}
          {activeTab === "po" && <PurchaseOrders />}
          {activeTab === "retours" && <RetoursTracker />}
          {activeTab === "livraison" && <LivraisonsPanel />}
          {activeTab === "reports" && <RapportsBenefices />}
          {activeTab === "marques" && <ShopifyBrandsConnector />}
          {activeTab === "settings" && <ParametresSysteme />}
        </div>
      </main>
    </div>
  );
}

function MainAppShell() {
  const { user, dbUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider animate-pulse">
          Démarrage du Terminal POS Magicaise...
        </span>
      </div>
    );
  }

  // If not logged in, show beautiful splash screen
  if (!user || !dbUser) {
    return <LoginScreen />;
  }

  return <DashboardContent />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppShell />
    </AuthProvider>
  );
}
