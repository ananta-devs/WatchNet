"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Globe,
  Gauge,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Plus,
  Play,
  Server,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import Link from "next/link";

interface InternetStatus {
  timestamp: string;
  wan_ip: string | null;
  gateway_latency_ms: number | null;
  dns_resolution_ms: number | null;
  is_connected: boolean;
  dns_resolvers: Record<string, number | null> | null;
  history_24h: Array<{
    timestamp: string;
    gateway_latency_ms: number | null;
    dns_resolution_ms: number | null;
    is_connected: boolean;
  }>;
}

interface SpeedtestResult {
  id?: number;
  timestamp: string;
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
  jitter_ms: number;
  server_name?: string;
  server_location?: string;
}

interface WebsiteTarget {
  id: string;
  url: string;
  name: string | null;
  check_interval_sec: number;
  is_active: boolean;
  last_status_code: number | null;
  last_latency_ms: number | null;
  ssl_days_remaining: number | null;
  is_up: boolean;
  uptime_percentage: number;
}

export default function MonitoringPage() {
  const [internet, setInternet] = useState<InternetStatus | null>(null);
  const [speedHistory, setSpeedHistory] = useState<SpeedtestResult[]>([]);
  const [websites, setWebsites] = useState<WebsiteTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSpeedtest, setRunningSpeedtest] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMonitoringData = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [intRes, speedRes, webRes] = await Promise.all([
        fetch("/api/v1/monitoring/internet", { headers, credentials: "include" }),
        fetch("/api/v1/monitoring/speedtest/history?limit=15", { headers, credentials: "include" }),
        fetch("/api/v1/monitoring/websites", { headers, credentials: "include" })
      ]);

      if (intRes.ok) setInternet(await intRes.json());
      if (speedRes.ok) setSpeedHistory(await speedRes.json());
      if (webRes.ok) setWebsites(await webRes.json());
    } catch (e) {
      console.error("Failed fetching monitoring telemetry", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerSpeedtest = async () => {
    setRunningSpeedtest(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/monitoring/speedtest/run", {
        method: "POST",
        headers,
        credentials: "include"
      });
      if (res.ok) {
        const newRun = await res.json();
        setSpeedHistory((prev) => [...prev, newRun]);
      }
    } catch (e) {
      console.error("Speedtest failed", e);
    } finally {
      setRunningSpeedtest(false);
    }
  };

  const addWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    setActionLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/monitoring/websites", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ url: newUrl, name: newName || newUrl, check_interval_sec: 60 })
      });
      if (res.ok) {
        const added = await res.json();
        setWebsites((prev) => [...prev, added]);
        setNewUrl("");
        setNewName("");
        setModalOpen(false);
      }
    } catch (e) {
      console.error("Failed adding website target", e);
    } finally {
      setActionLoading(false);
    }
  };

  const checkWebsiteNow = async (id: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/monitoring/websites/${id}/check`, {
        method: "POST",
        headers,
        credentials: "include"
      });
      if (res.ok) {
        const updated = await res.json();
        setWebsites((prev) => prev.map((w) => (w.id === id ? updated : w)));
      }
    } catch (e) {
      console.error("Probe failed", e);
    }
  };

  const deleteWebsite = async (id: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/monitoring/websites/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include"
      });
      if (res.ok || res.status === 204) {
        setWebsites((prev) => prev.filter((w) => w.id !== id));
      }
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const latestSpeed = speedHistory.length > 0 ? speedHistory[speedHistory.length - 1] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Active Network Monitoring</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time WAN telemetry, latency telemetry, automated speedtests & endpoint uptime
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/monitoring/wallboard"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition"
          >
            <Activity className="w-4 h-4 text-indigo-400" />
            NOC Wallboard View
          </Link>
          <button
            onClick={fetchMonitoringData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top WAN Connectivity & Gateway Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">WAN Status</span>
            <Globe className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                internet?.is_connected ? "bg-emerald-500 shadow-emerald-500/50 shadow" : "bg-red-500"
              }`}
            />
            <span className="text-2xl font-bold">
              {internet?.is_connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono truncate">
            IP: {internet?.wan_ip || "Auto-probing..."}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Gateway Latency</span>
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-bold">
            {internet?.gateway_latency_ms !== null && internet?.gateway_latency_ms !== undefined
              ? `${internet.gateway_latency_ms} ms`
              : "—"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Hop 1 reachability</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">DNS Avg Resolution</span>
            <Server className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold">
            {internet?.dns_resolution_ms !== null && internet?.dns_resolution_ms !== undefined
              ? `${internet.dns_resolution_ms} ms`
              : "—"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Multi-upstream resolver test</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monitored Sites</span>
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400">
            {websites.filter((w) => w.is_up).length} / {websites.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Active endpoint checks</div>
        </div>
      </div>

      {/* Speedtest Widget & Latency History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Speedtest Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-indigo-400" />
                Network Throughput
              </h2>
              <button
                onClick={triggerSpeedtest}
                disabled={runningSpeedtest}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
              >
                {runningSpeedtest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {runningSpeedtest ? "Testing..." : "Run Test"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 my-6">
              <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                  Download
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {latestSpeed ? `${latestSpeed.download_mbps}` : "—"}
                  <span className="text-xs text-slate-400 font-normal ml-1">Mbps</span>
                </div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <ArrowUpRight className="w-4 h-4 text-indigo-400" />
                  Upload
                </div>
                <div className="text-2xl font-bold text-indigo-400 mt-1">
                  {latestSpeed ? `${latestSpeed.upload_mbps}` : "—"}
                  <span className="text-xs text-slate-400 font-normal ml-1">Mbps</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-400 border-t border-slate-800/80 pt-4">
              <div className="flex justify-between">
                <span>Latency / Ping:</span>
                <span className="font-semibold text-slate-200">
                  {latestSpeed ? `${latestSpeed.ping_ms} ms` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Jitter:</span>
                <span className="font-semibold text-slate-200">
                  {latestSpeed ? `${latestSpeed.jitter_ms} ms` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Edge Server:</span>
                <span className="text-slate-300 truncate max-w-[180px]">
                  {latestSpeed?.server_name || "Cloudflare Anycast"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 text-[11px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last run: {latestSpeed ? new Date(latestSpeed.timestamp).toLocaleTimeString() : "Never"}
          </div>
        </div>

        {/* Speed & Latency History Mini-Graph */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center justify-between">
            <span>Throughput & Latency Trajectory</span>
            <span className="text-xs text-slate-500 font-normal">Recent {speedHistory.length} Probes</span>
          </h2>

          {speedHistory.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No historical speedtest data recorded yet. Run a speedtest above.
            </div>
          ) : (
            <div className="h-52 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-800 overflow-x-auto">
              {speedHistory.map((item, idx) => {
                const maxMbps = Math.max(...speedHistory.map((s) => s.download_mbps), 100);
                const heightPercent = Math.min(100, Math.max(10, (item.download_mbps / maxMbps) * 100));
                return (
                  <div key={idx} className="flex-1 min-w-[32px] flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 bg-slate-800 text-[10px] px-2 py-0.5 rounded shadow pointer-events-none transition whitespace-nowrap z-10">
                      {item.download_mbps} Mbps | {item.ping_ms} ms
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-gradient-to-t from-indigo-600 to-emerald-400 rounded-t-sm group-hover:brightness-125 transition"
                    />
                    <span className="text-[9px] text-slate-500">
                      {new Date(item.timestamp).getHours()}:{new Date(item.timestamp).getMinutes()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-6 mt-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Download Throughput (Mbps)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              Upload Throughput (Mbps)
            </div>
          </div>
        </div>
      </div>

      {/* Website Targets & SSL Monitoring Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-indigo-400" />
              Website Uptime & SSL Expiration Probes
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated HTTP status validation and TLS certificate renewal warnings
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Target
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Website Target</th>
                <th className="px-4 py-3">HTTP Code</th>
                <th className="px-4 py-3">Response Latency</th>
                <th className="px-4 py-3">Uptime</th>
                <th className="px-4 py-3">SSL Certificate</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {websites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No website targets currently being monitored. Click &quot;Add Target&quot; to begin.
                  </td>
                </tr>
              ) : (
                websites.map((site) => (
                  <tr key={site.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3">
                      {site.is_up ? (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <CheckCircle2 className="w-4 h-4" /> UP
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                          <XCircle className="w-4 h-4" /> DOWN
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{site.name || site.url}</div>
                      <div className="text-xs text-slate-500 font-mono">{site.url}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {site.last_status_code ? (
                        <span
                          className={`px-2 py-0.5 rounded ${
                            site.last_status_code < 400
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {site.last_status_code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {site.last_latency_ms ? `${site.last_latency_ms} ms` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-emerald-400 font-semibold">{site.uptime_percentage}%</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {site.ssl_days_remaining !== null && site.ssl_days_remaining !== undefined ? (
                        site.ssl_days_remaining <= 15 ? (
                          <span className="flex items-center gap-1 text-amber-400 font-semibold">
                            <ShieldAlert className="w-3.5 h-3.5" /> {site.ssl_days_remaining} days (Expiring Soon!)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-300">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {site.ssl_days_remaining} days
                          </span>
                        )
                      ) : (
                        <span className="text-slate-500">Non-SSL / Unavailable</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => checkWebsiteNow(site.id)}
                        className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                      >
                        Probe
                      </button>
                      <button
                        onClick={() => deleteWebsite(site.id)}
                        className="px-2 py-1 text-xs rounded bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 transition"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-1">Add Website Target</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the full HTTP or HTTPS endpoint to monitor response codes, uptime, and SSL.
            </p>
            <form onSubmit={addWebsite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Target URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Friendly Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Corporate Website"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                >
                  {actionLoading ? "Adding..." : "Add Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
