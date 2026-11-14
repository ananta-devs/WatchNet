"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Activity, Database, Server, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

interface HealthStatus {
  status: string;
  database: string;
  redis: string;
  timestamp: string;
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/health");
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setError(`Failed to fetch health status: HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Failed to connect to backend");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    const interval = setInterval(() => {
      void fetchHealth();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">System Health & Telemetry</h1>
          <p className="text-sm text-muted mt-1">Real-time status of WatchNet core platform services</p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text text-sm font-medium rounded-lg border border-border transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-status-critical/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-rose-700 dark:text-status-critical flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core Platform Status */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Core Engine</span>
            <Activity className="w-5 h-5 text-accent" />
          </div>
          <div className="flex items-center gap-3">
            {health?.status === "healthy" ? (
              <CheckCircle2 className="w-6 h-6 text-status-online" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-status-warning" />
            )}
            <div>
              <div className="text-lg font-bold capitalize text-text">{health?.status || "Unknown"}</div>
              <div className="text-xs text-slate-500">API Gateway & Routers</div>
            </div>
          </div>
        </div>

        {/* PostgreSQL Database */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">PostgreSQL 16</span>
            <Database className="w-5 h-5 text-accent" />
          </div>
          <div className="flex items-center gap-3">
            {health?.database.startsWith("healthy") ? (
              <CheckCircle2 className="w-6 h-6 text-status-online" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-status-critical" />
            )}
            <div>
              <div className="text-lg font-bold capitalize text-text">{health?.database || "Disconnected"}</div>
              <div className="text-xs text-slate-500">Async Session Pool</div>
            </div>
          </div>
        </div>

        {/* Redis Cache */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Redis 7 Broker</span>
            <Server className="w-5 h-5 text-accent" />
          </div>
          <div className="flex items-center gap-3">
            {health?.redis.startsWith("healthy") ? (
              <CheckCircle2 className="w-6 h-6 text-status-online" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-status-critical" />
            )}
            <div>
              <div className="text-lg font-bold capitalize text-text">{health?.redis || "Disconnected"}</div>
              <div className="text-xs text-slate-500">Event Stream & Cache</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Diagnostics Information</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-border text-text">
            <span className="text-muted">Last Telemetry Ping</span>
            <span className="font-mono text-text">{health?.timestamp ? new Date(health.timestamp).toLocaleString() : "N/A"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border text-text">
            <span className="text-muted">Collector Socket Privileges</span>
            <span className="text-status-online font-mono font-medium">CAP_NET_RAW Active</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border text-text">
            <span className="text-muted">Alembic Migration Version</span>
            <span className="font-mono text-accent font-medium">0001_initial_schema</span>
          </div>
        </div>
      </div>
    </div>
  );
}
