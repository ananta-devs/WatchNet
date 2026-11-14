"use client";

import React, { useState, useEffect } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  Activity,
  Globe,
  Gauge,
  ExternalLink,
  RefreshCw,
  Plus,
  Play,
  Server,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Clock,
  X
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

  useScrollLock(modalOpen);

  const fetchMonitoringData = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
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
  }, []);

  const triggerSpeedtest = async () => {
    try {
      setRunningSpeedtest(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/monitoring/speedtest/run", {
        method: "POST",
        headers,
        credentials: "include"
      });
      if (res.ok) {
        const latest = await res.json();
        setSpeedHistory((prev) => [...prev, latest]);
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
    try {
      setActionLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/monitoring/websites", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          url: newUrl,
          name: newName || null,
          check_interval_sec: 60
        })
      });
      if (res.ok) {
        const created = await res.json();
        setWebsites((prev) => [...prev, created]);
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
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
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
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 border-b border-border pb-3 sm:pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text flex items-center gap-2">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-accent shrink-0" />
            <span>Active Network Monitoring</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Real-time WAN telemetry, latency telemetry, automated speedtests & endpoint uptime
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            href="/monitoring/wallboard"
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3.5 py-2 sm:py-1.5 text-xs font-semibold rounded-lg bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition min-h-[38px] sm:min-h-[32px]"
          >
            <Activity className="w-4 h-4 text-accent" />
            NOC Wallboard View
          </Link>
          <button
            onClick={fetchMonitoringData}
            disabled={loading}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3.5 py-2 sm:py-1.5 text-xs font-semibold rounded-lg bg-surface hover:bg-hover text-text border border-border transition cursor-pointer min-h-[38px] sm:min-h-[32px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top WAN Connectivity & Gateway Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <div className="bg-surface border border-border shadow-xs rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">WAN Status</span>
            <Globe className="w-5 h-5 text-accent" />
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                internet?.is_connected ? "bg-status-online" : "bg-status-critical"
              }`}
            />
            <span className="text-2xl font-bold text-text">
              {internet?.is_connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="text-xs text-muted mt-2 font-mono truncate">
            IP: {internet?.wan_ip || "Auto-probing..."}
          </div>
        </div>

        <div className="bg-surface border border-border shadow-xs rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Gateway Latency</span>
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-text">
            {internet?.gateway_latency_ms !== null && internet?.gateway_latency_ms !== undefined
              ? `${internet.gateway_latency_ms} ms`
              : "—"}
          </div>
          <div className="text-xs text-muted mt-1">Hop 1 reachability</div>
        </div>

        <div className="bg-surface border border-border shadow-xs rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">DNS Avg Resolution</span>
            <Server className="w-5 h-5 text-accent" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-text">
            {internet?.dns_resolution_ms !== null && internet?.dns_resolution_ms !== undefined
              ? `${internet.dns_resolution_ms} ms`
              : "—"}
          </div>
          <div className="text-xs text-muted mt-1">Multi-upstream resolver test</div>
        </div>

        <div className="bg-surface border border-border shadow-xs rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Monitored Sites</span>
            <Activity className="w-5 h-5 text-status-online" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-status-online">
            {websites.filter((w) => w.is_up).length} / {websites.length}
          </div>
          <div className="text-xs text-muted mt-1">Active endpoint checks</div>
        </div>
      </div>

      {/* Speedtest Widget & Latency History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Speedtest Section */}
        <div className="bg-surface border border-border shadow-xs rounded-xl p-4 sm:p-6 lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-text flex items-center gap-2">
                <Gauge className="w-4 h-4 text-accent" />
                Network Throughput
              </h2>
              <button
                onClick={triggerSpeedtest}
                disabled={runningSpeedtest}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-accent hover:bg-accent-hover text-white transition disabled:opacity-50 cursor-pointer min-h-[32px]"
              >
                {runningSpeedtest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {runningSpeedtest ? "Testing..." : "Run Test"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 my-4 sm:my-6">
              <div className="bg-background/60 p-3 sm:p-4 rounded-lg border border-border">
                <div className="flex items-center gap-1 text-xs text-muted">
                  <ArrowDownRight className="w-4 h-4 text-status-online" />
                  Download
                </div>
                <div className="text-2xl font-bold text-status-online mt-1">
                  {latestSpeed ? `${latestSpeed.download_mbps}` : "—"}
                  <span className="text-xs text-muted font-normal ml-1">Mbps</span>
                </div>
              </div>

              <div className="bg-background/60 p-3 sm:p-4 rounded-lg border border-border">
                <div className="flex items-center gap-1 text-xs text-muted">
                  <ArrowUpRight className="w-4 h-4 text-accent" />
                  Upload
                </div>
                <div className="text-2xl font-bold text-accent mt-1">
                  {latestSpeed ? `${latestSpeed.upload_mbps}` : "—"}
                  <span className="text-xs text-muted font-normal ml-1">Mbps</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted border-t border-border pt-4">
              <div className="flex justify-between">
                <span>Latency / Ping:</span>
                <span className="font-semibold text-text">
                  {latestSpeed ? `${latestSpeed.ping_ms} ms` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Jitter:</span>
                <span className="font-semibold text-text">
                  {latestSpeed ? `${latestSpeed.jitter_ms} ms` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Edge Server:</span>
                <span className="text-text truncate max-w-[180px]">
                  {latestSpeed?.server_name || "Cloudflare Anycast"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 text-[11px] text-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last run: {latestSpeed ? new Date(latestSpeed.timestamp).toLocaleTimeString() : "Never"}
          </div>
        </div>

        {/* Speed & Latency History Mini-Graph */}
        <div className="bg-surface border border-border shadow-xs rounded-xl p-4 sm:p-6 lg:col-span-2">
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-text mb-4 flex items-center justify-between">
            <span>Throughput & Latency Trajectory</span>
            <span className="text-xs text-muted font-normal">Recent {speedHistory.length} Probes</span>
          </h2>

          {speedHistory.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs sm:text-sm text-muted border border-dashed border-border rounded-lg">
              No historical speedtest data recorded yet. Run a speedtest above.
            </div>
          ) : (
            <div className="h-48 sm:h-52 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-border overflow-x-auto min-w-[280px]">
              {speedHistory.map((item, idx) => {
                const maxMbps = Math.max(...speedHistory.map((s) => s.download_mbps), 100);
                const heightPercent = Math.min(100, Math.max(10, (item.download_mbps / maxMbps) * 100));
                return (
                  <div key={idx} className="flex-1 min-w-[32px] flex flex-col items-center gap-1 group relative">
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 bg-surface border border-border text-text text-[10px] px-2 py-0.5 rounded shadow-xs pointer-events-none transition whitespace-nowrap z-10">
                      {item.download_mbps} Mbps | {item.ping_ms} ms
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-gradient-to-t from-accent to-status-online rounded-t-xs group-hover:brightness-110 transition"
                    />
                    <span className="text-[9px] text-muted font-mono">
                      {new Date(item.timestamp).getHours()}:{new Date(item.timestamp).getMinutes()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 text-xs text-muted">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-status-online" />
              Download Throughput (Mbps)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent" />
              Upload Throughput (Mbps)
            </div>
          </div>
        </div>
      </div>

      {/* Website Targets & SSL Monitoring Section */}
      <div className="bg-surface border border-border shadow-xs rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-5">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-text flex items-center gap-2">
              <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
              Website Uptime & SSL Expiration Probes
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Automated HTTP status validation and TLS certificate renewal warnings
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-semibold rounded-lg bg-accent hover:bg-accent-hover text-white transition cursor-pointer min-h-[40px] sm:min-h-[32px]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Target
          </button>
        </div>

        {/* Mobile card view for website probes */}
        <div className="block md:hidden space-y-3">
          {websites.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted border border-border rounded-xl">
              No website targets currently being monitored. Click &quot;Add Target&quot; to begin.
            </div>
          ) : (
            websites.map((site) => (
              <div key={site.id} className="p-3.5 rounded-xl border border-border bg-background/50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-text text-sm block truncate">{site.name || "Endpoint"}</span>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted hover:text-accent font-mono truncate block"
                    >
                      {site.url}
                    </a>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 uppercase tracking-wider ${
                      site.is_up
                        ? "bg-status-online/10 text-status-online border border-status-online/20"
                        : "bg-status-critical/10 text-status-critical border border-status-critical/20"
                    }`}
                  >
                    {site.is_up ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {site.is_up ? "UP" : "DOWN"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/80">
                  <div>
                    <span className="text-[10px] text-muted block uppercase">HTTP Code</span>
                    <span className="font-mono text-text font-medium">{site.last_status_code || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block uppercase">Latency</span>
                    <span className="font-mono text-text font-medium">{site.last_latency_ms !== null ? `${site.last_latency_ms} ms` : "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block uppercase">Uptime</span>
                    <span className="text-text font-medium">{site.uptime_percentage ?? 100}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block uppercase">SSL Remaining</span>
                    <span className="text-text font-medium">{site.ssl_days_remaining !== null ? `${site.ssl_days_remaining} days` : "N/A"}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <button
                    onClick={() => checkWebsiteNow(site.id)}
                    className="px-3 py-1.5 text-xs rounded bg-surface hover:bg-hover text-text border border-border transition min-h-[36px]"
                  >
                    Probe Now
                  </button>
                  <button
                    onClick={() => deleteWebsite(site.id)}
                    className="px-3 py-1.5 text-xs rounded bg-status-critical/10 hover:bg-status-critical/20 text-status-critical border border-status-critical/30 transition min-h-[36px]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table view for website probes */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-text">
            <thead className="bg-hover/50 text-muted uppercase text-[11px] font-semibold border-b border-border">
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
            <tbody className="divide-y divide-border/60">
              {websites.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                    No website targets currently being monitored. Click &quot;Add Target&quot; to begin.
                  </td>
                </tr>
              ) : (
                websites.map((site) => (
                  <tr key={site.id} className="hover:bg-hover transition">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          site.is_up
                            ? "bg-status-online/10 text-status-online border border-status-online/20"
                            : "bg-status-critical/10 text-status-critical border border-status-critical/20"
                        }`}
                      >
                        {site.is_up ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {site.is_up ? "UP" : "DOWN"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text">{site.name || "Target"}</div>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted hover:text-accent font-mono truncate max-w-xs block"
                      >
                        {site.url}
                      </a>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {site.last_status_code ? (
                        <span className={site.last_status_code < 400 ? "text-status-online" : "text-status-critical"}>
                          {site.last_status_code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {site.last_latency_ms !== null ? `${site.last_latency_ms} ms` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">
                      {site.uptime_percentage ? `${site.uptime_percentage}%` : "100%"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {site.ssl_days_remaining !== null ? (
                        <span
                          className={
                            site.ssl_days_remaining < 15
                              ? "text-status-critical font-bold"
                              : site.ssl_days_remaining < 30
                              ? "text-status-warning font-semibold"
                              : "text-muted"
                          }
                        >
                          {site.ssl_days_remaining} days left
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => checkWebsiteNow(site.id)}
                        className="px-2.5 py-1 text-xs rounded bg-surface hover:bg-hover text-text border border-border transition cursor-pointer"
                      >
                        Probe
                      </button>
                      <button
                        onClick={() => deleteWebsite(site.id)}
                        className="px-2.5 py-1 text-xs rounded bg-status-critical/10 hover:bg-status-critical/20 text-status-critical border border-status-critical/30 transition cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-border shadow-xl rounded-xl max-w-md w-full p-5 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base sm:text-lg font-bold text-text">Add Website Target</h3>
              <button onClick={() => setModalOpen(false)} className="text-muted hover:text-text p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-muted mb-4">
              Enter the full HTTP or HTTPS endpoint to monitor response codes, uptime, and SSL.
            </p>
            <form onSubmit={addWebsite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Target URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent min-h-[38px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Friendly Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Corporate Website"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent min-h-[38px]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface hover:bg-hover text-text border border-border transition min-h-[38px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-accent hover:bg-accent-hover text-white disabled:opacity-50 shadow-xs transition min-h-[38px] cursor-pointer"
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
