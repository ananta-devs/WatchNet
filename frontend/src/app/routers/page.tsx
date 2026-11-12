"use client";

import React, { useState, useEffect } from "react";
import {
  Router as RouterIcon,
  Plus,
  RefreshCw,
  Wifi,
  Radio,
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Signal,
  ArrowDownUp,
  Clock,
  Shield,
  Trash2,
  X
} from "lucide-react";

interface RouterItem {
  id: string;
  name: string;
  vendor: string;
  model: string | null;
  firmware: string | null;
  host: string;
  port: number;
  username: string | null;
  is_active: boolean;
  last_connected_at: string | null;
  client_count: number;
}

interface RouterClient {
  mac: string;
  ip?: string;
  hostname?: string;
  interface?: string;
  connection_type: string;
  band?: string;
  rssi?: number;
  tx_rate?: number;
  rx_rate?: number;
  lease_time_remaining?: number;
}

export default function RoutersPage() {
  const [routers, setRouters] = useState<RouterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRouter, setActiveRouter] = useState<RouterItem | null>(null);
  const [clients, setClients] = useState<RouterClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // Form state
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("OpenWrt");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(80);
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");

  const fetchRouters = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/routers");
      if (res.ok) {
        const data = await res.json();
        setRouters(data);
        if (data.length > 0 && !activeRouter) {
          setActiveRouter(data[0]);
          fetchClients(data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch routers", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async (routerId: string) => {
    setLoadingClients(true);
    try {
      const res = await fetch(`/api/v1/routers/${routerId}/clients`);
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (e) {
      console.error("Failed to fetch clients", e);
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    fetchRouters();
  }, []);

  const handleTestConnection = async (r: RouterItem) => {
    setTestingId(r.id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/v1/routers/${r.id}/test`, {
        method: "POST"
      });
      const data = await res.json();
      setTestResult({ id: r.id, ...data });
      fetchRouters();
    } catch (e: any) {
      setTestResult({ id: r.id, success: false, message: e.message });
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncClients = async (r: RouterItem) => {
    setSyncingId(r.id);
    try {
      await fetch(`/api/v1/routers/${r.id}/sync`, { method: "POST" });
      await fetchRouters();
      if (activeRouter?.id === r.id) {
        await fetchClients(r.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteRouter = async (id: string) => {
    if (!confirm("Are you sure you want to remove this router?")) return;
    try {
      await fetch(`/api/v1/routers/${id}`, { method: "DELETE" });
      setRouters((prev) => prev.filter((r) => r.id !== id));
      if (activeRouter?.id === id) {
        setActiveRouter(null);
        setClients([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/routers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, vendor, host, port: Number(port), username, password })
      });
      if (res.ok) {
        setModalOpen(false);
        setName("");
        setHost("");
        setPassword("");
        fetchRouters();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <RouterIcon className="w-7 h-7 text-indigo-400" />
            Router Intelligence & Vendor Adapters
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time client extraction, signal strength (RSSI), frequency band & DHCP telemetry across OpenWrt, UniFi, ASUS, FRITZ!Box, MikroTik, and Omada.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRouters}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Add Router
          </button>
        </div>
      </div>

      {/* Router Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {routers.map((r) => {
          const isSelected = activeRouter?.id === r.id;
          return (
            <div
              key={r.id}
              onClick={() => {
                setActiveRouter(r);
                fetchClients(r.id);
              }}
              className={`p-5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? "bg-slate-800/80 border-indigo-500 shadow-md shadow-indigo-500/10"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{r.name}</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-950 text-indigo-400 border border-indigo-800/50">
                      {r.vendor}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    {r.host}:{r.port}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Model:</span>
                  <p className="font-medium text-slate-300 truncate">{r.model || "Generic"}</p>
                </div>
                <div>
                  <span className="text-slate-500">Firmware:</span>
                  <p className="font-medium text-slate-300 truncate">{r.firmware || "Auto"}</p>
                </div>
                <div>
                  <span className="text-slate-500">Live Clients:</span>
                  <p className="font-medium text-indigo-400">{r.client_count} connected</p>
                </div>
                <div>
                  <span className="text-slate-500">Last Poll:</span>
                  <p className="font-medium text-slate-300 truncate">
                    {r.last_connected_at ? new Date(r.last_connected_at).toLocaleTimeString() : "Never"}
                  </p>
                </div>
              </div>

              {testResult && testResult.id === r.id && (
                <div className={`mt-3 p-2 rounded text-xs border ${testResult.success ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/50" : "bg-rose-950/50 text-rose-300 border-rose-800/50"}`}>
                  {testResult.message}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(r)}
                    disabled={testingId === r.id}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    {testingId === r.id ? "Testing..." : "Test Connection"}
                  </button>
                  <button
                    onClick={() => handleSyncClients(r)}
                    disabled={syncingId === r.id}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-300 transition"
                  >
                    {syncingId === r.id ? "Syncing..." : "Sync Clients"}
                  </button>
                </div>
                <button
                  onClick={() => handleDeleteRouter(r.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                  title="Remove Router"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {routers.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
            <RouterIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No Routers Registered</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add your OpenWrt, UniFi, ASUS, FRITZ!Box, MikroTik, or Omada gateway to inspect wireless stations and band telemetry.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
            >
              Add First Router
            </button>
          </div>
        )}
      </div>

      {/* Connected Clients Table */}
      {activeRouter && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-indigo-400" />
                Live Clients on {activeRouter.name} ({clients.length})
              </h2>
              <span className="text-xs text-slate-400">
                Synchronized Wi-Fi association metrics, band allocation, and lease duration
              </span>
            </div>
            <button
              onClick={() => fetchClients(activeRouter.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingClients ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Device / Hostname</th>
                  <th className="px-6 py-3">MAC / IP</th>
                  <th className="px-6 py-3">Connection</th>
                  <th className="px-6 py-3">Band</th>
                  <th className="px-6 py-3">Signal (RSSI)</th>
                  <th className="px-6 py-3">TX / RX Rate</th>
                  <th className="px-6 py-3">Lease Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {clients.map((c, idx) => {
                  const rssi = c.rssi || -70;
                  const signalPercent = Math.min(100, Math.max(0, (rssi + 100) * 2));
                  return (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      <td className="px-6 py-3 font-medium text-slate-200">
                        {c.hostname || "Unknown Station"}
                      </td>
                      <td className="px-6 py-3 text-slate-400 font-mono text-[11px]">
                        <div>{c.mac}</div>
                        <div className="text-slate-500">{c.ip || "—"}</div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          c.connection_type === "wifi"
                            ? "bg-indigo-950 text-indigo-400 border border-indigo-800/40"
                            : "bg-slate-800 text-slate-300"
                        }`}>
                          {c.connection_type === "wifi" ? <Wifi className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                          {c.connection_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-300 font-medium">
                        {c.band || "—"}
                      </td>
                      <td className="px-6 py-3">
                        {c.connection_type === "wifi" ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${signalPercent > 60 ? "bg-emerald-400" : signalPercent > 35 ? "bg-amber-400" : "bg-rose-400"}`}
                                style={{ width: `${signalPercent}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-400">{rssi} dBm</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">Ethernet</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-slate-400">
                        <div className="flex items-center gap-1 text-[11px]">
                          <ArrowDownUp className="w-3 h-3 text-slate-500" />
                          <span>{c.tx_rate ? `${c.tx_rate} Mbps` : "—"} / {c.rx_rate ? `${c.rx_rate} Mbps` : "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-slate-400 text-[11px]">
                        {c.lease_time_remaining ? `${Math.round(c.lease_time_remaining / 60)} min` : "Static / Unlimited"}
                      </td>
                    </tr>
                  );
                })}

                {clients.length === 0 && !loadingClients && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No active client associations currently reported by this router. Click "Sync Clients" above to poll.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Router Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-indigo-400" /> Register Gateway Router
            </h3>
            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Router Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Office Core Gateway"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Router Vendor</label>
                <select
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="OpenWrt">OpenWrt (LuCI RPC / ubus)</option>
                  <option value="UniFi">Ubiquiti UniFi (UniFi OS / Controller)</option>
                  <option value="AsusWrt">ASUSWRT / Merlin (dnsmasq / wl assoclist)</option>
                  <option value="FRITZ!Box">AVM FRITZ!Box (TR-064 SOAP)</option>
                  <option value="MikroTik">MikroTik RouterOS (v7 REST API)</option>
                  <option value="Omada">TP-Link Omada SDN (OpenAPI Controller)</option>
                  <option value="Generic">Generic Linux Gateway</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">IP / Hostname</label>
                  <input
                    type="text"
                    required
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="192.168.1.1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Port</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-1">
                <Shield className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                Read-only adapter: WatchNet will never modify your router firewall or WAN settings.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-semibold"
                >
                  Save Router
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

