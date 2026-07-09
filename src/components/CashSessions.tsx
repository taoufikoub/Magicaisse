import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import { Coins, LogIn, LogOut, CheckCircle, RefreshCw, AlertTriangle } from "lucide-react";

interface Session {
  id: number;
  cashierName: string;
  openingCash: string;
  closingCash: string | null;
  expectedClosingCash: string | null;
  discrepancyAmount: string | null;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
}

export default function CashSessions({
  activeSession,
  onRefreshSessions,
}: {
  activeSession: Session | null;
  onRefreshSessions: () => void;
}) {
  const { fetchWithAuth, dbUser } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  // Opening Cash Register Form State
  const [openingCashInput, setOpeningCashInput] = useState("150.00");

  // Closing Cash Register Form State
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingCashInput, setClosingCashInput] = useState("300.00");

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/sales/sessions");
      if (res.ok) {
        setSessions(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingCashInput) return;

    try {
      const res = await fetchWithAuth("/api/sales/sessions", {
        method: "POST",
        body: JSON.stringify({ openingCash: openingCashInput }),
      });
      if (res.ok) {
        onRefreshSessions();
        fetchSessions();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to open register");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !closingCashInput) return;

    try {
      const res = await fetchWithAuth(`/api/sales/sessions/${activeSession.id}/close`, {
        method: "POST",
        body: JSON.stringify({ closingCash: closingCashInput }),
      });
      if (res.ok) {
        setShowCloseModal(false);
        setClosingCashInput("");
        onRefreshSessions();
        fetchSessions();
      } else {
        alert("Failed to close register");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] text-slate-800">
      {/* LEFT: Active Session Control (5 cols) */}
      <div className="lg:col-span-5 flex flex-col space-y-4 h-full">
        {activeSession ? (
          // Active session summary
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center space-x-2 text-emerald-800 mb-4">
                <CheckCircle className="w-6 h-6 animate-pulse text-emerald-600" />
                <h3 className="font-extrabold text-base">Cash Register is Open</h3>
              </div>

              <div className="space-y-3 text-xs text-emerald-900 font-semibold">
                <div className="flex justify-between border-b border-emerald-200/50 pb-2">
                  <span>Current Cashier:</span>
                  <span className="font-bold text-slate-800">{activeSession.cashierName}</span>
                </div>
                <div className="flex justify-between border-b border-emerald-200/50 pb-2">
                  <span>Register Opened Float:</span>
                  <span className="font-bold text-slate-800">${parseFloat(activeSession.openingCash).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-emerald-200/50 pb-2">
                  <span>Opened Timestamp:</span>
                  <span className="font-mono text-slate-600">
                    {new Date(activeSession.openedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowCloseModal(true)}
              className="w-full mt-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg flex items-center justify-center space-x-1 shadow-md transition-all text-sm"
            >
              <LogOut className="w-4.5 h-4.5" />
              <span>Close Register & Declare Cash</span>
            </button>
          </div>
        ) : (
          // Open new session form
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-slate-800 mb-4">
                <Coins className="w-6 h-6 text-indigo-600" />
                <h3 className="font-extrabold text-base">Open Cash Register Drawer</h3>
              </div>

              <p className="text-xs text-slate-400 font-medium leading-relaxed mb-5">
                Declare the starting cash float inside the cash drawer (usually $150 or similar) to open a new sales session.
              </p>

              <form onSubmit={handleOpenSession} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Opening Cash Float ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-extrabold text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center justify-center space-x-1.5 shadow-md shadow-indigo-100 transition-all text-sm"
                >
                  <LogIn className="w-4.5 h-4.5" />
                  <span>Open Register Drawer</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Sessions history log (7 cols) */}
      <div className="lg:col-span-7 bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col h-full min-h-0">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <Coins className="w-4.5 h-4.5 text-indigo-600" />
            <h3 className="font-extrabold text-base text-slate-800">Cash Sessions Log</h3>
          </div>

          <button
            onClick={fetchSessions}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Sessions scrolling feed */}
        <div className="flex-1 overflow-y-auto pr-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="py-2.5">Cashier</th>
                <th className="py-2.5 text-center">Float ($)</th>
                <th className="py-2.5 text-center">Closing Cash</th>
                <th className="py-2.5 text-center">Discrepancy</th>
                <th className="py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sessions.map((sess) => (
                <tr key={sess.id} className="hover:bg-slate-50/50">
                  <td className="py-3 pr-2 font-medium text-slate-700">
                    <span className="font-semibold block text-slate-800">{sess.cashierName}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      ID: #{sess.id} | {new Date(sess.openedAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-3 text-center text-slate-700 font-bold">
                    ${parseFloat(sess.openingCash).toFixed(2)}
                  </td>
                  <td className="py-3 text-center text-slate-700">
                    {sess.closingCash ? `$${parseFloat(sess.closingCash).toFixed(2)}` : "-"}
                  </td>
                  <td className="py-3 text-center font-bold">
                    {sess.discrepancyAmount !== null ? (
                      <span
                        className={
                          parseFloat(sess.discrepancyAmount) === 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }
                      >
                        {parseFloat(sess.discrepancyAmount) > 0 ? "+" : ""}
                        ${parseFloat(sess.discrepancyAmount).toFixed(2)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        sess.status === "open"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-100 animate-pulse"
                          : "bg-slate-100 text-slate-800 border border-slate-200"
                      }`}
                    >
                      {sess.status}
                    </span>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No register sessions logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: DECLARE CLOSING BALANCE DIALOG */}
      {showCloseModal && activeSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <h3 className="font-extrabold text-lg text-slate-800 mb-1 flex items-center space-x-1.5">
              <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" />
              <span>Declare Closing Register Cash</span>
            </h3>
            <p className="text-xs text-slate-400 font-semibold mb-4 uppercase tracking-wider">
              Register closing procedure
            </p>

            <form onSubmit={handleCloseSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  Actual physical cash in register ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 450.00"
                  value={closingCashInput}
                  onChange={(e) => setClosingCashInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block leading-tight font-medium">
                  Count all coins and banknotes in the physical cash register. The POS will calculate discrepancies automatically.
                </span>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-sm shadow-md"
                >
                  Declare & Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
