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
          <h1 className="text-2xl font-bold tracking-tight">System Health & Telemetry</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time status of WatchNet core platform services</p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core Platform Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Core Engine</span>
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex items-center gap-3">
            {health?.status === "healthy" ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            )}
            <div>
              <div className="text-lg font-bold capitalize">{health?.status || "Unknown"}</div>
              <div className="text-xs text-slate-500">API Gateway & Routers</div>
            </div>
          </div>
        </div>

        {/* PostgreSQL Database */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">PostgreSQL 16</span>
            <Database className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex items-center gap-3">
            {health?.database.startsWith("healthy") ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            )}
            <div>
              <div className="text-lg font-bold capitalize">{health?.database || "Disconnected"}</div>
              <div className="text-xs text-slate-500">Async Session Pool</div>
            </div>
          </div>
        </div>

        {/* Redis Cache */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Redis 7 Broker</span>
            <Server className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex items-center gap-3">
            {health?.redis.startsWith("healthy") ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            )}
            <div>
              <div className="text-lg font-bold capitalize">{health?.redis || "Disconnected"}</div>
              <div className="text-xs text-slate-500">Event Stream & Cache</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Diagnostics Information</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Last Telemetry Ping</span>
            <span className="font-mono">{health?.timestamp ? new Date(health.timestamp).toLocaleString() : "N/A"}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Collector Socket Privileges</span>
            <span className="text-emerald-400 font-mono">CAP_NET_RAW Active</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-800">
            <span className="text-slate-400">Alembic Migration Version</span>
            <span className="font-mono text-indigo-400">0001_initial_schema</span>
          </div>
        </div>
      </div>
    </div>
  );
}
