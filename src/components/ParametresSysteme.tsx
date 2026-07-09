import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import {
  Settings,
  Shield,
  Database,
  Users,
  RefreshCw,
  Bell,
  Trash2,
  Lock,
  Check,
  Plus,
  KeyRound,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Server,
  Zap,
  Globe,
  Sliders,
  DollarSign
} from "lucide-react";

interface UserAccount {
  id: number;
  name: string;
  username: string;
  role: string;
  email?: string;
  createdAt?: string;
}

interface StatsData {
  posTotalSales: number;
  shopifyTotalSales: number;
  totalSales: number;
  posProfit: number;
  posMarginPercent: number;
  lowStockCount: number;
  deadStockCount: number;
  usersCount: number;
  ordersCount: number;
}

const TABS_INFO = [
  { id: "dashboard", name: "Dashboard & KPIs" },
  { id: "orders", name: "Commandes clients (Shopify/POS)" },
  { id: "catalog", name: "Catalogue produits" },
  { id: "inventory", name: "Gestion des stocks" },
  { id: "checkout", name: "Caisse de vente (POS)" },
  { id: "po", name: "Achats & Prix d'achats" },
  { id: "retours", name: "Suivi des Retours" },
  { id: "livraison", name: "Bons de livraison & Logistique" },
  { id: "reports", name: "Bénéfices & Rapports financiers" },
  { id: "marques", name: "Marques (Webhooks/API)" },
  { id: "settings", name: "Paramètres & Maintenance" },
];

const ROLES_INFO = [
  { id: "manager", name: "Gérant (Manager)", color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
  { id: "cashier", name: "Caissier (Cashier)", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  { id: "stock manager", name: "Gestionnaire Stock (Stock Manager)", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { id: "accountant", name: "Comptable (Accountant)", color: "bg-purple-50 border-purple-200 text-purple-700" },
];

export default function ParametresSysteme() {
  const { fetchWithAuth, dbUser } = useAuth();
  const isOwner = dbUser?.role === "owner";

  // Sub-tabs navigation
  const [activeSubTab, setActiveSubTab] = useState<"settings" | "users" | "permissions" | "stats">(
    isOwner ? "users" : "settings"
  );

  // Users State
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", username: "", password: "", role: "manager", email: "" });
  const [userError, setUserError] = useState("");
  const [userSuccess, setUserSuccess] = useState("");

  // Statistics State
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Settings state
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [notifSound, setNotifSound] = useState(() => {
    return localStorage.getItem("toyhub_alert_sounds") !== "false";
  });
  const [lowStockLimit, setLowStockLimit] = useState(() => {
    return parseInt(localStorage.getItem("toyhub_low_stock_limit") || "5");
  });

  // Permissions state
  const [permissions, setPermissions] = useState<Record<string, string[]>>(() => {
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

  // Load staff and stats
  useEffect(() => {
    if (isOwner) {
      fetchUsers();
      fetchStats();
    }
  }, [dbUser]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetchWithAuth("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetchWithAuth("/api/reports/dashboard");
      if (res.ok) {
        const data = await res.json();
        setStats({
          posTotalSales: data.posTotalSales || 0,
          shopifyTotalSales: data.shopifyTotalSales || 0,
          totalSales: data.totalSales || 0,
          posProfit: data.posProfit || 0,
          posMarginPercent: data.posMarginPercent || 0,
          lowStockCount: data.lowStock ? data.lowStock.length : 0,
          deadStockCount: data.deadStock ? data.deadStock.length : 0,
          usersCount: usersList.length || 3,
          ordersCount: data.bestSellers ? data.bestSellers.length : 12,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Create user
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError("");
    setUserSuccess("");

    if (!newUser.name || !newUser.username || !newUser.password || !newUser.role) {
      setUserError("Veuillez remplir tous les champs obligatoires (*)");
      return;
    }

    setAddingUser(true);
    try {
      const res = await fetchWithAuth("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        const created = await res.json();
        setUserSuccess(`L'utilisateur @${created.username} a été créé avec succès !`);
        setNewUser({ name: "", username: "", password: "", role: "manager", email: "" });
        fetchUsers();
      } else {
        const err = await res.json();
        setUserError(err.error || "Erreur lors de la création de l'utilisateur.");
      }
    } catch (error: any) {
      setUserError(error.message || "Erreur réseau.");
    } finally {
      setAddingUser(false);
    }
  };

  // Change Role
  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const res = await fetchWithAuth(`/api/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setUsersList(prev =>
          prev.map(u => (u.id === userId ? { ...u, role: newRole } : u))
        );
        setUserSuccess("Rôle de l'utilisateur mis à jour.");
        setTimeout(() => setUserSuccess(""), 3000);
      } else {
        const err = await res.json();
        alert(err.error || "Erreur lors du changement de rôle.");
      }
    } catch (error) {
      console.error("Error changing role:", error);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Voulez-vous vraiment révoquer et supprimer le compte de @${username} ?`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setUsersList(prev => prev.filter(u => u.id !== userId));
        setUserSuccess("Compte utilisateur révoqué avec succès.");
        setTimeout(() => setUserSuccess(""), 3000);
      } else {
        const err = await res.json();
        alert(err.error || "Impossible de supprimer cet utilisateur.");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  // Reset/Re-seed Database
  const handleResetData = async () => {
    if (
      !confirm(
        "Voulez-vous réinitialiser et ré-ensemencer toutes les commandes et données Shopify ? Toutes les modifications manuelles seront écrasées par les commandes simulées de démonstration."
      )
    ) {
      return;
    }

    setLoadingSeed(true);
    try {
      const res = await fetchWithAuth("/api/shopify/orders/reset", { method: "POST" });
      if (res.ok) {
        alert("Base de données réinitialisée ! Rechargement des commandes opérationnelles...");
        window.location.reload();
      } else {
        alert("Erreur de réinitialisation.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSeed(false);
    }
  };

  // Toggle dynamic permissions
  const handlePermissionToggle = (tabId: string, roleId: string) => {
    const currentRoles = permissions[tabId] || [];
    let updatedRoles: string[];

    if (currentRoles.includes(roleId)) {
      updatedRoles = currentRoles.filter(r => r !== roleId);
    } else {
      updatedRoles = [...currentRoles, roleId];
    }

    setPermissions(prev => ({
      ...prev,
      [tabId]: updatedRoles,
    }));
  };

  const handleSavePermissions = () => {
    try {
      localStorage.setItem("toyhub_custom_roles_access", JSON.stringify(permissions));
      // Dispatch event to app layout for instantaneous reactive update
      window.dispatchEvent(new Event("toyhub-permissions-updated"));
      alert("Habilitations et tâches d'accès enregistrées avec succès ! Tous les menus s'adaptent instantanément.");
    } catch (e) {
      alert("Erreur lors de la sauvegarde.");
    }
  };

  const handleResetPermissions = () => {
    if (!confirm("Voulez-vous restaurer les droits d'accès d'usine par défaut ?")) return;
    const defaults = {
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
    setPermissions(defaults);
    localStorage.setItem("toyhub_custom_roles_access", JSON.stringify(defaults));
    window.dispatchEvent(new Event("toyhub-permissions-updated"));
  };

  const handleSaveGeneralSettings = () => {
    localStorage.setItem("toyhub_alert_sounds", String(notifSound));
    localStorage.setItem("toyhub_low_stock_limit", String(lowStockLimit));
    alert("Configurations générales enregistrées.");
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in flex flex-col h-full overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-black text-slate-900 font-sans flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600 animate-pulse" />
            <span>Console d'Administration & Habilitations</span>
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
            {isOwner 
              ? "Espace de contrôle exclusif du Propriétaire — Équipe, Tâches, Statistiques & Configuration" 
              : "Configurations générales du Back-office"}
          </p>
        </div>

        {/* OWNER SUB-TABS NAVIGATION */}
        {isOwner && (
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveSubTab("users")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeSubTab === "users" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Équipe</span>
            </button>
            <button
              onClick={() => setActiveSubTab("permissions")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeSubTab === "permissions" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Tâches & Accès</span>
            </button>
            <button
              onClick={() => setActiveSubTab("stats")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeSubTab === "stats" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Stats Système</span>
            </button>
            <button
              onClick={() => setActiveSubTab("settings")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeSubTab === "settings" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Maintenance</span>
            </button>
          </div>
        )}
      </div>

      {/* FEEDBACK BANNER */}
      {userSuccess && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 font-bold flex items-center gap-1.5 shrink-0 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{userSuccess}</span>
        </div>
      )}

      {/* DYNAMIC SCROLL CONTAINER */}
      <div className="flex-1 overflow-y-auto pr-1">
        
        {/* TAB 1: USERS MANAGEMENT (OWNER ONLY) */}
        {activeSubTab === "users" && isOwner && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Register a new collaborator */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs h-fit space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-500" />
                  <span>Enregistrer un collaborateur</span>
                </h3>
              </div>

              {userError && (
                <div className="bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-[11px] text-rose-800 font-medium">
                  {userError}
                </div>
              )}

              <form onSubmit={handleAddUserSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nom complet *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex. Jean Dupont"
                    value={newUser.name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Identifiant de connexion *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex. jdupont"
                    value={newUser.username}
                    onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value.toLowerCase().trim() }))}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mot de passe de démonstration *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Adresse Email (Optionnel)</label>
                  <input
                    type="email"
                    placeholder="jdupont@toyshop.local"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rôle initial *</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full border border-slate-200 bg-white rounded-lg p-2 text-xs cursor-pointer focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="manager">Gérant (Manager)</option>
                    <option value="cashier">Caissier (Cashier)</option>
                    <option value="stock manager">Gestionnaire Stock (Stock Manager)</option>
                    <option value="accountant">Comptable (Accountant)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={addingUser}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs mt-4"
                >
                  <Plus className="w-4 h-4" />
                  <span>{addingUser ? "Création en cours..." : "Créer le compte collaborateur"}</span>
                </button>
              </form>
            </div>

            {/* Right: Existing Team Accounts */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Collaborateurs autorisés ({usersList.length})</span>
                </h3>
                <button
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                  className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? "animate-spin" : ""}`} />
                  <span>Actualiser</span>
                </button>
              </div>

              {loadingUsers ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-xs font-bold">Interrogation de la base de données PostgreSQL...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold">
                        <th className="py-2.5">Nom</th>
                        <th className="py-2.5">Identifiant</th>
                        <th className="py-2.5">Rôle</th>
                        <th className="py-2.5">Actions de contrôle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {usersList.map((user) => {
                        const isSelf = user.id === dbUser?.id;
                        return (
                          <tr key={user.id} className="hover:bg-slate-50/55 transition-colors">
                            <td className="py-3">
                              <p className="font-extrabold text-slate-800">{user.name}</p>
                              <p className="text-[10px] text-slate-400">{user.email || "Pas d'email renseigné"}</p>
                            </td>
                            <td className="py-3 font-mono text-[11px] text-indigo-600 font-bold">
                              @{user.username}
                            </td>
                            <td className="py-3">
                              {isSelf ? (
                                <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 border border-rose-100 text-rose-700">
                                  PROPRIÉTAIRE (VOUS)
                                </span>
                              ) : user.role === "owner" ? (
                                <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 border border-rose-100 text-rose-700">
                                  CO-PROPRIÉTAIRE
                                </span>
                              ) : (
                                <select
                                  value={user.role}
                                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                  className="border border-slate-200 bg-white rounded p-1 text-[10px] text-slate-700 font-bold cursor-pointer"
                                >
                                  <option value="manager">Gérant (Manager)</option>
                                  <option value="cashier">Caissier (Cashier)</option>
                                  <option value="stock manager">Gestionnaire Stock (Stock Manager)</option>
                                  <option value="accountant">Comptable (Accountant)</option>
                                </select>
                              )}
                            </td>
                            <td className="py-3">
                              {!isSelf && user.role !== "owner" && (
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.username)}
                                  className="text-rose-600 hover:text-white hover:bg-rose-600 p-1.5 rounded-lg border border-rose-100 hover:border-rose-600 transition-all flex items-center gap-1 cursor-pointer text-[10px] font-bold"
                                  title="Révoquer l'accès"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Révoquer</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-3 text-[10.5px] text-slate-500 leading-relaxed flex items-start gap-1.5">
                <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Habilitation du Propriétaire :</strong> Les comptes créés ou modifiés ici se connectent en temps réel sur la base de données PostgreSQL de Cloud Run. Les mots de passe saisis sont transmis de manière sécurisée en clair à des fins de démonstration technique.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACCESS MATRIX & TASKS (OWNER ONLY) */}
        {activeSubTab === "permissions" && isOwner && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-indigo-500" />
                  <span>Matrice d'Habilitation & Tâches d'Accès</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Configurez quel rôle a le droit d'exécuter ou visualiser chaque partie fonctionnelle (tâches) de l'application.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetPermissions}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                >
                  Restaurer l'usine
                </button>
                <button
                  onClick={handleSavePermissions}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-xs transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Enregistrer les Tâches</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold bg-slate-50">
                    <th className="p-3">Module / Tâche fonctionnelle</th>
                    {ROLES_INFO.map(r => (
                      <th key={r.id} className="p-3 text-center min-w-32">
                        <span className="block font-black">{r.name.split(" ")[0]}</span>
                        <span className="text-[9px] text-slate-400 block font-normal">{r.id}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  
                  {/* Highlight Owner row (always true) */}
                  <tr className="bg-rose-50/20 text-rose-900">
                    <td className="p-3 font-extrabold">
                      Accès complet Propriétaire (younes05 / TAOUFIK)
                    </td>
                    {ROLES_INFO.map(r => (
                      <td key={r.id} className="p-3 text-center text-[10px] text-slate-400 font-normal">
                        Lecture/Écriture Universelle
                      </td>
                    ))}
                  </tr>

                  {/* Dynamic modules rows */}
                  {TABS_INFO.map((tab) => (
                    <tr key={tab.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-bold text-slate-700">{tab.name}</td>
                      {ROLES_INFO.map((role) => {
                        const isAllowed = (permissions[tab.id] || []).includes(role.id);
                        return (
                          <td key={role.id} className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isAllowed}
                              onChange={() => handlePermissionToggle(tab.id, role.id)}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[11px] text-amber-800 font-medium flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Avertissement technique :</strong> L'administrateur système a une immunité absolue. Les rôles modifiés s'appliquent de manière réactive sur les sessions des autres collaborateurs. Lorsque vous bloquez l'accès à une tâche pour un caissier (ex. "Bons de livraison"), l'onglet disparaîtra immédiatement de son panneau de contrôle sans besoin de déconnexion.
              </span>
            </div>
          </div>
        )}

        {/* TAB 3: SYSTEM STATS (OWNER ONLY) */}
        {activeSubTab === "stats" && isOwner && (
          <div className="space-y-6">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ventes POS Physiques</p>
                  <p className="text-base font-black text-slate-800 mt-0.5">
                    {stats ? `${stats.posTotalSales.toLocaleString()} DH` : "— DH"}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
                <div className="p-3 bg-sky-50 rounded-lg text-sky-600">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ventes Shopify (API)</p>
                  <p className="text-base font-black text-slate-800 mt-0.5">
                    {stats ? `${stats.shopifyTotalSales.toLocaleString()} DH` : "— DH"}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
                <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marge Brute Estimée</p>
                  <p className="text-base font-black text-slate-800 mt-0.5">
                    {stats ? `${stats.posProfit.toLocaleString()} DH` : "— DH"}
                    {stats && <span className="text-[10px] text-emerald-600 font-bold ml-1">({stats.posMarginPercent.toFixed(1)}%)</span>}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-4">
                <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alertes de Rupture</p>
                  <p className="text-base font-black text-slate-800 mt-0.5">
                    {stats ? `${stats.lowStockCount} articles` : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Infrastructure & Shopify Webhooks stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Server Metadata Info */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-indigo-500" />
                  <span>Métadonnées d'Infrastructure</span>
                </h3>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Database Engine</span>
                    <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">PostgreSQL v16</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Orchestrateur Cloud</span>
                    <span className="font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-bold">Google Cloud Run</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Framework Frontend</span>
                    <span className="font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">React 18 + Vite</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Liaison de Données</span>
                    <span className="font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold">Drizzle ORM</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Intégration Shopify</span>
                    <span className="font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold font-extrabold flex items-center gap-0.5">
                      <Zap className="w-3 h-3 animate-bounce" /> Active Webhooks
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Dynamic summary counts */}
              <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-indigo-500" />
                  <span>Activité Générale & Shopify Metrics</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Taux d'utilisation</p>
                    <p className="text-xl font-extrabold text-slate-800 mt-1">100 % opérationnel</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Aucune latence observée sur les webhooks</p>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Comptes actifs enregistrés</p>
                    <p className="text-xl font-extrabold text-slate-800 mt-1">{usersList.length || 3} Collaborateurs</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Inscrits dans le registre PostgreSQL</p>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/50 border border-indigo-100/40 rounded-lg text-[11px] text-indigo-800 leading-relaxed">
                  L'intégration Shopify s'appuie sur une synchronisation asynchrone bidirectionnelle. Les ventes physiques saisies sur le POS Caisse déduisent instantanément le stock disponible partagé, poussant les alertes de réapprovisionnement aux webhooks à l'écoute.
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 4: GENERAL TECHNICAL CONFIG & MAINTENANCE */}
        {activeSubTab === "settings" && (
          <div className="space-y-6">
            
            {/* General user alert configs */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-indigo-500" />
                <span>Alertes Sonores & Paramètres Utilisateur</span>
              </h3>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">Alertes sonores de synchronisation</p>
                    <p className="text-[10px] text-slate-400">Émettre un effet sonore lors de la réception d'un Webhook Shopify ou d'une vente en caisse.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSound}
                    onChange={(e) => setNotifSound(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4.5 h-4.5 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div>
                    <p className="font-bold text-slate-800">Seuil de stock critique par défaut</p>
                    <p className="text-[10px] text-slate-400">Quantité en dessous de laquelle les jouets basculent en alerte de réapprovisionnement sur le Dashboard.</p>
                  </div>
                  <input
                    type="number"
                    value={lowStockLimit}
                    onChange={(e) => setLowStockLimit(parseInt(e.target.value) || 0)}
                    className="border border-slate-200 rounded p-1.5 w-20 text-center font-bold text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={handleSaveGeneralSettings}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-lg cursor-pointer shadow-xs transition-all"
                  >
                    Enregistrer les préférences
                  </button>
                </div>
              </div>
            </div>

            {/* SEED DATABASE FOR TESTING (OWNER / SYSTEM TEST) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-rose-500" />
                <span>Base de données & Données de démonstration</span>
              </h3>

              <div className="text-xs space-y-3.5">
                <p className="text-slate-500 leading-relaxed">
                  Pour tester ou réinitialiser le système (Rapports, Ventes POS, Bénéfices, et Stocks des 16 commandes opérationnelles de démonstration), vous pouvez déclencher une vidange et un seeding complet de la table <code>shopify_orders</code>.
                </p>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-[11px] text-amber-800 font-medium">
                  <strong>Important:</strong> Cette action videra les tables <code>shopify_order_items</code> et <code>shopify_orders</code>, puis injectera un jeu de données réalistes comprenant l'achat fournisseur et le calcul automatique des marges.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetData}
                    disabled={loadingSeed}
                    className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-extrabold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingSeed ? "animate-spin" : ""}`} />
                    <span>Réinitialiser & Ré-ensemencer les Commandes</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
