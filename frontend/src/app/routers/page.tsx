"use client";

import React, { useState, useEffect } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  Router as RouterIcon,
  Plus,
  RefreshCw,
  Wifi,
  Server,
  CheckCircle2,
  Signal,
  ArrowDownUp,
  Clock,
  Shield,
  Trash2,
  X
} from "lucide-react";

interface RouterTelemetry {
  passive_arp: boolean;
  icmp_reachability: boolean;
  dns_ptr_resolution: boolean;
  neighbor_discovery: boolean;
  dhcp_lease_ingestion: boolean;
  wifi_association_rssi: boolean;
  band_steering_metrics: boolean;
  snmp_interface_tables: boolean;
  proprietary_client_api: boolean;
}

interface RouterItem {
  id: string;
  name: string;
  vendor: string;
  integration_level?: string;
  telemetry?: RouterTelemetry;
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

  useScrollLock(modalOpen);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // Form state
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("OpenWrt");
  const [integrationLevel, setIntegrationLevel] = useState("read_only_api");
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
      console.error(e);
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
      const res = await fetch(`/api/v1/routers/${r.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult({ id: r.id, success: res.ok, message: data.message || (res.ok ? "Connected successfully" : "Connection failed") });
    } catch (e: any) {
      setTestResult({ id: r.id, success: false, message: e.message });
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncClients = async (r: RouterItem) => {
    setSyncingId(r.id);
    try {
      const res = await fetch(`/api/v1/routers/${r.id}/sync`, { method: "POST" });
      if (res.ok) {
        fetchClients(r.id);
        fetchRouters();
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
        body: JSON.stringify({ name, vendor, integration_level: integrationLevel, host, port: Number(port), username, password })
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text flex items-center gap-2">
            <RouterIcon className="w-6 h-6 sm:w-7 sm:h-7 text-accent shrink-0" />
            <span>Router Intelligence & Vendor Adapters</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Real-time client extraction, signal strength (RSSI), frequency band & DHCP telemetry across OpenWrt, UniFi, ASUS, FRITZ!Box, MikroTik, and Omada.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={fetchRouters}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3 py-2 bg-surface hover:bg-hover text-text text-xs sm:text-sm font-medium rounded-lg border border-border transition min-h-[38px] cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs sm:text-sm font-medium rounded-lg shadow-xs transition min-h-[38px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Router
          </button>
        </div>
      </div>

      {/* Router Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {routers.map((r) => {
          const isSelected = activeRouter?.id === r.id;
          return (
            <div
              key={r.id}
              onClick={() => {
                setActiveRouter(r);
                fetchClients(r.id);
              }}
              className={`p-4 sm:p-5 rounded-xl border cursor-pointer transition-all shadow-xs ${
                isSelected
                  ? "bg-accent/10 border-accent ring-1 ring-accent/30"
                  : "bg-surface border-border hover:bg-hover"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="font-semibold text-text text-sm sm:text-base truncate">{r.name}</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-accent/10 text-accent border border-accent/20">
                      {r.vendor}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wider border ${
                      r.integration_level === "full_api"
                        ? "bg-status-online/10 text-status-online border-status-online/20"
                        : "bg-hover text-text border-border"
                    }`}>
                      {r.integration_level ? r.integration_level.replace(/_/g, " ") : "Read-only API"}
                    </span>
                  </div>
                  <span className="text-xs text-muted mt-1 block font-mono truncate">
                    {r.host}:{r.port}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-status-online/10 text-status-online border border-status-online/20">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted block text-[10px] uppercase">Model:</span>
                  <p className="font-medium text-text truncate">{r.model || "Generic"}</p>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase">Firmware:</span>
                  <p className="font-medium text-text truncate">{r.firmware || "Auto"}</p>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase">Live Clients:</span>
                  <p className="font-medium text-accent">{r.client_count} connected</p>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase">Last Poll:</span>
                  <p className="font-medium text-text truncate">
                    {r.last_connected_at ? new Date(r.last_connected_at).toLocaleTimeString() : "Never"}
                  </p>
                </div>
              </div>

              {testResult && testResult.id === r.id && (
                <div className={`mt-3 p-2 rounded text-xs border ${testResult.success ? "bg-status-online/10 text-status-online border-status-online/30" : "bg-status-critical/10 text-status-critical border-status-critical/30"}`}>
                  {testResult.message}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(r)}
                    disabled={testingId === r.id}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-surface hover:bg-hover text-text border border-border transition cursor-pointer min-h-[32px]"
                  >
                    {testingId === r.id ? "Testing..." : "Test Link"}
                  </button>
                  <button
                    onClick={() => handleSyncClients(r)}
                    disabled={syncingId === r.id}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 transition cursor-pointer min-h-[32px]"
                  >
                    {syncingId === r.id ? "Syncing..." : "Sync Clients"}
                  </button>
                </div>
                <button
                  onClick={() => handleDeleteRouter(r.id)}
                  className="p-1.5 text-muted hover:text-status-critical rounded hover:bg-hover transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                  title="Remove router"
                  aria-label="Remove router"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Router Clients Inspection */}
      {activeRouter && (
        <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                <Wifi className="w-5 h-5 text-accent" />
                <span>Active Clients Extracted from {activeRouter.name}</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Real-time Wi-Fi associations, radio frequencies, signal dBm, PHY data rates & DHCP leases
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">
                {clients.length} Total Connected Clients
              </span>
            </div>
          </div>

          {/* Mobile Card View for Router Clients */}
          <div className="block md:hidden divide-y divide-border">
            {clients.length === 0 && !loadingClients ? (
              <div className="p-6 text-center text-xs text-muted">
                No active client associations currently reported by this router. Click &quot;Sync Clients&quot; above to poll.
              </div>
            ) : (
              clients.map((c, idx) => {
                const rssi = c.rssi || -65;
                const signalPercent = Math.min(100, Math.max(0, (rssi + 100) * 1.6));
                return (
                  <div key={idx} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-text text-sm block">{c.hostname || "Unknown Station"}</span>
                        <span className="text-xs font-mono text-muted">{c.mac}</span>
                        {c.ip && <span className="text-xs font-mono text-text block">{c.ip}</span>}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-hover text-text border border-border">
                        {c.connection_type} {c.band ? `• ${c.band}` : ""}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-[10px] text-muted block uppercase">Signal Strength</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="w-16 bg-hover rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${signalPercent > 60 ? "bg-status-online" : signalPercent > 35 ? "bg-status-warning" : "bg-status-critical"}`}
                              style={{ width: `${signalPercent}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted">{rssi} dBm</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block uppercase">Throughput Rate</span>
                        <span className="text-text font-mono text-[11px]">
                          {c.tx_rate ? `${c.tx_rate}M` : "—"} / {c.rx_rate ? `${c.rx_rate}M` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View for Router Clients */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-hover/50 text-muted font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">Hostname / Station</th>
                  <th className="px-4 py-3">MAC / IP Address</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Band / Radio</th>
                  <th className="px-4 py-3">Signal (RSSI)</th>
                  <th className="px-4 py-3">PHY Tx/Rx Rate</th>
                  <th className="px-4 py-3">DHCP Lease</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {clients.map((c, idx) => {
                  const rssi = c.rssi || -65;
                  const signalPercent = Math.min(100, Math.max(0, (rssi + 100) * 1.6));
                  return (
                    <tr key={idx} className="hover:bg-hover transition">
                      <td className="px-4 py-3 font-medium text-text">
                        {c.hostname || "Unknown Station"}
                      </td>
                      <td className="px-4 py-3 text-muted font-mono text-[11px]">
                        <div>{c.mac}</div>
                        <div className="text-text">{c.ip || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-hover text-text border border-border">
                          {c.connection_type === "wifi" ? <Wifi className="w-3 h-3 text-accent" /> : <Server className="w-3 h-3 text-muted" />}
                          {c.connection_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text font-medium">
                        {c.band || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {c.connection_type === "wifi" ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-hover rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full ${signalPercent > 60 ? "bg-status-online" : signalPercent > 35 ? "bg-status-warning" : "bg-status-critical"}`}
                                style={{ width: `${signalPercent}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-muted">{rssi} dBm</span>
                          </div>
                        ) : (
                          <span className="text-muted">Ethernet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <div className="flex items-center gap-1 text-[11px]">
                          <ArrowDownUp className="w-3 h-3 text-muted" />
                          <span>{c.tx_rate ? `${c.tx_rate} Mbps` : "—"} / {c.rx_rate ? `${c.rx_rate} Mbps` : "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted text-[11px]">
                        {c.lease_time_remaining ? `${Math.round(c.lease_time_remaining / 60)} min` : "Static / Unlimited"}
                      </td>
                    </tr>
                  );
                })}

                {clients.length === 0 && !loadingClients && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted">
                      No active client associations currently reported by this router. Click &quot;Sync Clients&quot; above to poll.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-text cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-text mb-1">Register Gateway Router</h3>
            <p className="text-xs text-muted mb-4">
              Connect OpenWrt, UniFi Controller, ASUSWRT, or other gateway adapters to pull client telemetry.
            </p>

            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Friendly Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Core OpenWrt Gateway"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent min-h-[38px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Vendor / Type</label>
                  <select
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-text focus:outline-none focus:border-accent min-h-[38px]"
                  >
                    <option value="OpenWrt">OpenWrt (ubus / rpcd)</option>
                    <option value="UniFi">UniFi Network Controller</option>
                    <option value="ASUS">ASUSWRT (HTTP/SSH)</option>
                    <option value="FRITZ!Box">AVM FRITZ!Box (TR-064)</option>
                    <option value="MikroTik">MikroTik RouterOS (REST)</option>
                    <option value="Omada">TP-Link Omada SDN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">Integration Level</label>
                  <select
                    value={integrationLevel}
                    onChange={(e) => setIntegrationLevel(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-text focus:outline-none focus:border-accent min-h-[38px]"
                  >
                    <option value="read_only_api">Read-Only API</option>
                    <option value="full_api">Full API Control</option>
                    <option value="passive_discovery">Passive ARP / DHCP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-text mb-1">IP / Hostname</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.1"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent min-h-[38px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-text focus:outline-none focus:border-accent min-h-[38px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-text focus:outline-none focus:border-accent min-h-[38px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Password / API Key</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-text focus:outline-none focus:border-accent min-h-[38px]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm bg-surface hover:bg-hover text-text rounded-lg border border-border transition min-h-[38px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs sm:text-sm bg-accent hover:bg-accent-hover text-white font-medium rounded-lg shadow-xs transition min-h-[38px] cursor-pointer"
                >
                  Save Adapter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
