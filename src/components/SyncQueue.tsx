import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.tsx";
import { RefreshCw, Play, CheckCircle, XCircle, AlertCircle, Server } from "lucide-react";

interface SyncTask {
  id: number;
  brand: string;
  variantId: number;
  sku: string;
  stockLevel: number;
  status: "pending" | "processing" | "completed" | "failed";
  retryCount: number;
  errorMessage: string | null;
  updatedAt: string;
}

export default function SyncQueue() {
  const { fetchWithAuth } = useAuth();
  const [tasks, setTasks] = useState<SyncTask[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/inventory/sync-queue");
      if (res.ok) {
        setTasks(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryTask = async (taskId: number) => {
    try {
      const res = await fetchWithAuth(`/api/inventory/sync-queue/${taskId}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        fetchTasks();
      } else {
        alert("Failed to retry task sync.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcessAll = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/inventory/sync-queue/process", {
        method: "POST",
      });
      if (res.ok) {
        alert("Queue processing triggered successfully!");
        fetchTasks();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 h-full flex flex-col text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 mb-5 space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-extrabold text-lg text-slate-800 leading-tight">Shopify Sync Queue</h2>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
              Multi-Brand Stock Propagation Logs
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleProcessAll}
            disabled={loading}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-100 transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Process Queue</span>
          </button>

          <button
            onClick={fetchTasks}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Queue items list */}
      <div className="flex-1 overflow-x-auto min-h-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Task ID</th>
              <th className="py-3 px-4">Online Brand</th>
              <th className="py-3 px-4">Variant SKU</th>
              <th className="py-3 px-4 text-center">Stock Level</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-center">Retries</th>
              <th className="py-3 px-4">Last Error Message</th>
              <th className="py-3 px-4 text-right">Updated At</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-4 font-mono text-slate-500">
                  #{task.id}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="capitalize font-bold text-slate-700">
                    {task.brand.replace("_", " ")}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono font-extrabold text-slate-800">
                  {task.sku}
                </td>
                <td className="py-3 px-4 text-center font-black text-indigo-600">
                  {task.stockLevel}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center space-x-1 w-fit ${
                    task.status === "completed"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                      : task.status === "failed"
                      ? "bg-rose-50 text-rose-800 border border-rose-100"
                      : task.status === "processing"
                      ? "bg-sky-50 text-sky-800 border border-sky-100 animate-pulse"
                      : "bg-slate-100 text-slate-800 border border-slate-200"
                  }`}>
                    {task.status === "completed" && <CheckCircle className="w-3 h-3 mr-0.5" />}
                    {task.status === "failed" && <XCircle className="w-3 h-3 mr-0.5" />}
                    <span>{task.status}</span>
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-medium text-slate-600">
                  {task.retryCount} / 3
                </td>
                <td className="py-3 px-4 text-rose-500 max-w-xs truncate font-mono text-[10px]" title={task.errorMessage || ""}>
                  {task.errorMessage || <span className="text-slate-300">-</span>}
                </td>
                <td className="py-3 px-4 text-right text-slate-400 whitespace-nowrap">
                  {new Date(task.updatedAt).toLocaleTimeString()}
                </td>
                <td className="py-3 px-4 text-center">
                  {task.status === "failed" && (
                    <button
                      onClick={() => handleRetryTask(task.id)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-[10px] rounded-lg shadow-md shadow-indigo-100 transition-all"
                    >
                      Retry Task
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  Sync task queue is completely empty. Outstanding inventory levels are fully synchronized.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
