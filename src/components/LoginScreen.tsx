import React, { useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import { LogIn, Key, ShieldCheck, User, AlertCircle, Sparkles } from "lucide-react";

export default function LoginScreen() {
  const { login, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError("Veuillez remplir tous les champs.");
      return;
    }

    const result = await login(trimmedUsername, trimmedPassword);
    if (!result.success) {
      setError(result.error || "Nom d'utilisateur ou mot de passe invalide.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between p-6 text-slate-800">
      {/* Top Brand Tag */}
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-100">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <span className="text-lg font-black text-slate-800 tracking-tight">
          Magicaise <span className="text-indigo-600">POS</span>
        </span>
        <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
          Terminal Maître
        </span>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto bg-white border border-slate-200 shadow-xl rounded-2xl p-8 md:p-10 flex flex-col my-auto">
        <div className="flex flex-col items-center text-center mb-6">
          {/* Playful Decorative Logo Icon */}
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>

          <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">
            Terminal POS Magicaise
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1.5">
            Caisse physique & Synchronisation Shopify
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center space-x-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
              Identifiant Personnel (Username)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Entrez votre identifiant"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
              Mot de passe (Password)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center space-x-3 shadow-lg shadow-indigo-100 transition-all cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4 text-white" />
                <span>Se connecter au terminal</span>
              </>
            )}
          </button>
        </form>

        {/* Info Box about default account credentials */}
        <div className="mt-6 bg-indigo-50/50 border border-indigo-100/80 rounded-xl p-3.5 text-xs text-indigo-900">
          <p className="font-extrabold mb-1.5 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Identifiants d'accès d'usine :</span>
          </p>
          <div className="font-mono text-[11px] text-indigo-700 space-y-2 mt-1 bg-white/60 p-2.5 rounded-lg border border-indigo-100/30">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Compte Propriétaire 1 :</span>
              Utilisateur : <strong className="text-indigo-900">TAOUFIK</strong> • Passe : <strong className="text-indigo-900">123456</strong>
            </div>
            <div className="pt-1.5 border-t border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Compte Propriétaire 2 :</span>
              Utilisateur : <strong className="text-indigo-900">younes05</strong> • Passe : <strong className="text-indigo-900">123456</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Footer system credit line */}
      <div className="text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
        © 2026 Grand Magasin de Jouets S.A. • Terminal de Caisse National
      </div>
    </div>
  );
}
