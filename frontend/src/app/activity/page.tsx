"use client";

import React, { useState, useEffect } from "react";
import {
  FileClock,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  ExternalLink,
  Laptop
} from "lucide-react";

interface ActivityLogItem {
  id: number;
  timestamp: string;
  domain: string;
  query_type: string;
  action: "ALLOWED" | "BLOCKED_POLICY" | "BLOCKED_SECURITY";
  category: string | null;
  resolver_source: string;
  device?: {
    id: string;
    name: string | null;
    mac: string;
  } | null;
  profile?: {
    id: string;
    name: string;
    role: string;
  } | null;
}

interface AnalyticsData {
  total_queries: number;
  blocked_queries: number;
  allowed_queries: number;
  category_breakdown: Record<string, number>;
  top_blocked_domains: Array<{ domain: string; count: number }>;
  disclosure: string;
}

export default function ActivityCenterPage() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Activity Logs
      let url = "/api/v1/family/activity?limit=100";
      if (filterAction !== "all") {
        url += `&action=${filterAction}`;
      }
      if (searchQuery.trim()) {
        url += `&domain=${encodeURIComponent(searchQuery.trim())}`;
      }
      const logsRes = await fetch(url);
      if (logsRes.ok) {
        setLogs(await logsRes.json());
      }

      // 2. Fetch Analytics
      const analRes = await fetch("/api/v1/family/analytics");
      if (analRes.ok) {
        setAnalytics(await analRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterAction]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text flex items-center gap-2">
            <FileClock className="w-7 h-7 text-accent" />
            DNS Activity & Telemetry Center
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time domain query stream, AdGuard Home / Pi-hole resolution telemetry, and transparent filtering inspection.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text text-sm font-medium rounded-lg border border-border transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Stream
        </button>
      </div>

      {/* Transparent Disclosure Notice Card */}
      <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 flex items-start gap-3">
        <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
          <span className="font-semibold text-text block mb-0.5">Transparent Inspection Disclosure</span>
          {analytics?.disclosure || (
            "WatchNet Family Safety analyzes transparent DNS-layer query events only. It never performs HTTPS decryption, MITM SSL snooping, or content packet inspection. Bypass vectors such as DNS-over-HTTPS (DoH), encrypted VPN tunnels, and Apple iCloud Private Relay cannot be inspected at the DNS layer unless redirected at the gateway."
          )}
        </div>
      </div>

      {/* Analytics Summary Widget Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-surface border border-border shadow-sm">
            <span className="text-xs text-muted">Total Ingested Queries</span>
            <p className="text-2xl font-bold text-text mt-1">{analytics.total_queries}</p>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-border shadow-sm">
            <span className="text-xs text-muted">Allowed Queries</span>
            <p className="text-2xl font-bold text-status-online mt-1">{analytics.allowed_queries}</p>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-border shadow-sm">
            <span className="text-xs text-muted">Policy & Security Blocked</span>
            <p className="text-2xl font-bold text-status-critical mt-1">{analytics.blocked_queries}</p>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-border shadow-sm">
            <span className="text-xs text-muted">Active Resolver Source</span>
            <p className="text-base font-semibold text-indigo-600 dark:text-indigo-300 mt-1.5 truncate">AdGuard Home & Pi-hole</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search domain (e.g. google.com)..."
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-text placeholder-slate-400 focus:outline-none focus:border-accent"
          />
        </form>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-muted" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-accent"
          >
            <option value="all">All Actions</option>
            <option value="ALLOWED">Allowed Only</option>
            <option value="BLOCKED_POLICY">Policy Blocked</option>
            <option value="BLOCKED_SECURITY">Security Blocked</option>
          </select>
        </div>
      </div>

      {/* Query Stream Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background/60 text-muted font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Domain</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Device / Profile</th>
                <th className="px-6 py-3">Resolver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition">
                  <td className="px-6 py-3 text-muted text-[11px] whitespace-nowrap">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-3 font-medium text-text">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-800 dark:text-slate-300">{l.domain}</span>
                      <span className="text-[10px] text-muted px-1 py-0.5 rounded bg-hover font-mono border border-border">
                        {l.query_type}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      l.action === "ALLOWED"
                        ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-status-online border-emerald-200 dark:border-emerald-800/50"
                        : l.action === "BLOCKED_SECURITY"
                        ? "bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-status-critical border-rose-200 dark:border-rose-800/50"
                        : "bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50"
                    }`}>
                      {l.action === "ALLOWED" ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {l.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-text font-medium">
                    {l.category || "—"}
                  </td>
                  <td className="px-6 py-3 text-muted">
                    <div>{l.device?.name || l.device?.mac || "Unassigned"}</div>
                    {l.profile && (
                      <span className="text-[10px] text-accent font-medium">
                        Profile: {l.profile.name} ({l.profile.role})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-[11px]">
                    {l.resolver_source}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No DNS activity records match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

