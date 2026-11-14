"use client";

import React, { useState, useEffect } from "react";
import {
  FileClock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ExternalLink
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text flex items-center gap-2">
            <FileClock className="w-6 h-6 sm:w-7 sm:h-7 text-accent shrink-0" />
            <span>DNS Activity & Telemetry Center</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Real-time multi-resolver DNS logs, AdGuard/Pi-hole query stream & privacy-preserving resolution metrics.
          </p>
        </div>
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-muted tracking-wider">Total Queries (24h)</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-text mt-1">
            {analytics?.total_queries ?? "—"}
          </div>
          <span className="text-[11px] text-muted">Across all local clients</span>
        </div>

        <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-muted tracking-wider">Blocked (Policy & Threat)</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-status-critical mt-1">
            {analytics?.blocked_queries ?? "—"}
          </div>
          <span className="text-[11px] text-muted">
            {analytics?.total_queries ? `${Math.round(((analytics.blocked_queries || 0) / analytics.total_queries) * 100)}% block rate` : "0% block rate"}
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-muted tracking-wider">Allowed Queries</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-status-online mt-1">
            {analytics?.allowed_queries ?? "—"}
          </div>
          <span className="text-[11px] text-muted">Clean resolution passing through</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 sm:top-3 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search domain (e.g. google.com)..."
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent min-h-[38px]"
          />
        </form>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-muted shrink-0" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full sm:w-auto bg-surface border border-border rounded-lg px-3 py-2 text-xs sm:text-sm text-text focus:outline-none focus:border-accent min-h-[38px]"
          >
            <option value="all">All Actions</option>
            <option value="ALLOWED">Allowed Only</option>
            <option value="BLOCKED_POLICY">Policy Blocked</option>
            <option value="BLOCKED_SECURITY">Security Blocked</option>
          </select>
        </div>
      </div>

      {/* Mobile Card View for Activity Logs */}
      <div className="block md:hidden space-y-3">
        {logs.length === 0 && !loading ? (
          <div className="p-6 text-center text-xs text-muted border border-border rounded-xl bg-surface">
            No DNS activity records match the current filter.
          </div>
        ) : (
          logs.map((l) => (
            <div key={l.id} className="p-3.5 rounded-xl border border-border bg-surface space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-text text-sm font-mono break-all">{l.domain}</div>
                  <span className="text-[10px] text-muted font-mono px-1.5 py-0.5 rounded bg-hover border border-border inline-block mt-0.5">
                    {l.query_type}
                  </span>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${
                  l.action === "ALLOWED"
                    ? "bg-status-online/10 text-status-online border-status-online/20"
                    : l.action === "BLOCKED_SECURITY"
                    ? "bg-status-critical/10 text-status-critical border-status-critical/20"
                    : "bg-status-warning/10 text-status-warning border-status-warning/20"
                }`}>
                  {l.action === "ALLOWED" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {l.action}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Client / Device</span>
                  <span className="text-text truncate block">{l.device?.name || l.device?.mac || "Unassigned"}</span>
                  {l.profile && (
                    <span className="text-[10px] text-accent block">Profile: {l.profile.name}</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Category</span>
                  <span className="text-text font-medium">{l.category || "—"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-border/60">
                <span className="font-mono">{l.resolver_source}</span>
                <span>{new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Query Stream Table */}
      <div className="hidden md:block bg-surface border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-hover/50 text-muted font-semibold border-b border-border">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Device / Profile</th>
                <th className="px-4 py-3">Resolver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-hover transition">
                  <td className="px-4 py-3 text-muted text-[11px] whitespace-nowrap">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-text">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-text">{l.domain}</span>
                      <span className="text-[10px] text-muted px-1 py-0.5 rounded bg-hover font-mono border border-border">
                        {l.query_type}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      l.action === "ALLOWED"
                        ? "bg-status-online/10 text-status-online border-status-online/20"
                        : l.action === "BLOCKED_SECURITY"
                        ? "bg-status-critical/10 text-status-critical border-status-critical/20"
                        : "bg-status-warning/10 text-status-warning border-status-warning/20"
                    }`}>
                      {l.action === "ALLOWED" ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {l.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text font-medium">
                    {l.category || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <div>{l.device?.name || l.device?.mac || "Unassigned"}</div>
                    {l.profile && (
                      <span className="text-[10px] text-accent font-medium">
                        Profile: {l.profile.name} ({l.profile.role})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted text-[11px]">
                    {l.resolver_source}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted">
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
