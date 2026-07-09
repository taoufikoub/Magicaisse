import { useState } from "react";
import {
  Link,
  CheckCircle,
  RefreshCw,
  Clock,
  ExternalLink,
  ShieldAlert,
  Server,
  Zap,
  Check
} from "lucide-react";

interface BrandConfig {
  id: string;
  name: string;
  url: string;
  status: "connected" | "stale" | "error";
  lastSync: string;
  webhookUrl: string;
  itemCount: number;
}

export default function ShopifyBrandsConnector() {
  const [brands, setBrands] = useState<BrandConfig[]>([
    {
      id: "magijouets",
      name: "Magijouets",
      url: "magijouets-store.myshopify.com",
      status: "connected",
      lastSync: "Il y a 5 minutes",
      webhookUrl: "https://toyhub-hq.cloudrun.app/api/webhooks/shopify/magijouets",
      itemCount: 420
    },
    {
      id: "libijouets",
      name: "Libijouets",
      url: "libijouets-pro.myshopify.com",
      status: "connected",
      lastSync: "Il y a 12 minutes",
      webhookUrl: "https://toyhub-hq.cloudrun.app/api/webhooks/shopify/libijouets",
      itemCount: 380
    },
    {
      id: "allez_jouets",
      name: "Allez Jouets",
      url: "allez-jouets-shop.myshopify.com",
      status: "connected",
      lastSync: "Il y a 1 heure",
      webhookUrl: "https://toyhub-hq.cloudrun.app/api/webhooks/shopify/allez_jouets",
      itemCount: 510
    },
    {
      id: "kids_heaven",
      name: "Kids Heaven",
      url: "kids-heaven-online.myshopify.com",
      status: "connected",
      lastSync: "Il y a 30 minutes",
      webhookUrl: "https://toyhub-hq.cloudrun.app/api/webhooks/shopify/kids_heaven",
      itemCount: 290
    }
  ]);

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "[16:20:05] Webhook reçu de Libijouets : Commande #LB-1049 créée.",
    "[16:12:11] Sync automatique réussie de Magijouets (14 articles mis à jour).",
    "[15:45:00] Webhook reçu de Allez Jouets : Stock réconcilié.",
    "[15:10:44] Connexion au Webhook d'écoute active de Kids Heaven."
  ]);

  const handleSyncBrand = (brandId: string) => {
    setSyncingId(brandId);
    
    // Add logging entries dynamically
    setTimeout(() => {
      setSyncingId(null);
      const b = brands.find(b => b.id === brandId);
      if (b) {
        setBrands(prev => prev.map(item => item.id === brandId ? { ...item, lastSync: "À l'instant" } : item));
        setLogs(prev => [
          `[${new Date().toLocaleTimeString()}] Synchronisation manuelle complète de ${b.name} : OK (Stock et Commandes synchronisés).`,
          ...prev
        ]);
      }
    }, 1500);
  };

  const handleTriggerWebhookSimulate = (brandName: string) => {
    setLogs(prev => [
      `[${new Date().toLocaleTimeString()}] SIMULATION : Réception d'un Webhook Shopify de ${brandName} (order/created). Une nouvelle commande a été ajoutée.`,
      ...prev
    ]);
  };

  return (
    <div className="space-y-6 text-slate-800 animate-fade-in">
      
      {/* 1. Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 font-sans">Gestion des Marques & Connecteurs</h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Suivi de l’intégration API et des Webhooks de synchronisation</p>
      </div>

      {/* 2. Brand Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {brands.map((b) => (
          <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">{b.name}</h3>
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">{b.url}</p>
                </div>
                
                <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Connecté</span>
                </span>
              </div>

              {/* Webhook API url indicator */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5 text-[10px]">
                <p className="text-slate-400 font-bold uppercase tracking-wider">URL du Webhook Shopify</p>
                <code className="text-indigo-600 block truncate select-all">{b.webhookUrl}</code>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-400 font-medium">Articles au catalogue</p>
                  <p className="font-extrabold text-slate-800 mt-0.5">{b.itemCount} jouets</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Dernière sync</p>
                  <p className="font-extrabold text-slate-800 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                    {b.lastSync}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 border-t border-slate-100 pt-4 mt-4">
              <button
                onClick={() => handleSyncBrand(b.id)}
                disabled={syncingId !== null}
                className="flex-1 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 font-extrabold text-xs py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingId === b.id ? "animate-spin" : ""}`} />
                <span>Synchroniser</span>
              </button>

              <button
                onClick={() => handleTriggerWebhookSimulate(b.name)}
                className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] py-2 px-3 rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                title="Tester Webhook"
              >
                Simuler Webhook
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 3. SYNC REALTIME LOGS */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg overflow-hidden flex flex-col">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-3 shrink-0">
          <Server className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">Logs de synchronisation en temps réel (Webhooks)</h3>
        </div>

        <div className="font-mono text-[11px] text-indigo-200/90 space-y-1.5 h-44 overflow-y-auto pr-1">
          {logs.map((log, idx) => (
            <p key={idx} className="leading-relaxed truncate">
              {log}
            </p>
          ))}
        </div>
      </div>

    </div>
  );
}
