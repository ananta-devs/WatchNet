"use client";

import React, { useState, useEffect } from "react";
import {
  Radar,
  Play,
  RefreshCw,
  Server,
  Network,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings2,
  Terminal,
  Shield,
  Search
} from "lucide-react";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

interface DiscoveryStatus {
  is_running: boolean;
  last_scan_time: string | null;
  last_duration_sec: number;
  modules_active: string[];
  total_discovered: number;
}

const MODULES = [
  { id: "arp", name: "ARP Scanner", description: "Direct layer 2 broadcast probe for local subnets", icon: Network },
  { id: "icmp", name: "ICMP Ping Prober", description: "High-concurrency ICMP ping sweep with RTT tracking", icon: Activity },
  { id: "ipneigh", name: "IP Neighbor Table", description: "Kernel /proc/net/arp and Netlink neighbor table inspection", icon: Layers },
  { id: "dhcp", name: "DHCP Lease Parser", description: "Reads dnsmasq, ISC DHCP, and Kea lease dumps", icon: Server },
  { id: "snmp", name: "SNMP Gateway Walker", description: "Queries router/switch ARP (ipNetToMedia) and FDB bridge tables", icon: Shield },
  { id: "nmap", name: "Nmap Service / OS Prober", description: "Deep OS fingerprinting and service banner grabbing", icon: Search },
];

export default function DiscoveryDashboard() {
  const [status, setStatus] = useState<DiscoveryStatus>({
    is_running: false,
    last_scan_time: null,
    last_duration_sec: 0,
    modules_active: ["arp", "icmp", "ipneigh"],
    total_discovered: 0,
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [ports, setPorts] = useState("22,80,443");
  const [triggering, setTriggering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStatusAndLogs = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const [statusRes, logsRes] = await Promise.all([
        fetch("/api/v1/discovery/status", { credentials: "include", headers }),
        fetch("/api/v1/discovery/logs?limit=40", { credentials: "include", headers })
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      // Background poll fail tolerance
    }
  };

  useEffect(() => {
    fetchStatusAndLogs();
    const interval = setInterval(fetchStatusAndLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerScan = async () => {
    setTriggering(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem("access_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/discovery/scan", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          cidr,
          modules: status.modules_active,
          ports
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to trigger scan");
      }
      fetchStatusAndLogs();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to launch scan");
    } finally {
      setTriggering(false);
    }
  };

  const handleToggleModule = async (moduleId: string) => {
    const isCurrentlyActive = status.modules_active.includes(moduleId);
    const nextState = !isCurrentlyActive;

    // Optimistic UI update
    setStatus(prev => ({
      ...prev,
      modules_active: nextState
        ? [...prev.modules_active, moduleId]
        : prev.modules_active.filter(m => m !== moduleId)
    }));

    try {
      const token = localStorage.getItem("access_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch("/api/v1/discovery/toggle-module", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ module: moduleId, enabled: nextState })
      });
      fetchStatusAndLogs();
    } catch (e) {
      // Revert if error
      fetchStatusAndLogs();
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Radar className="w-8 h-8 text-indigo-400" />
            Network Discovery Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Orchestrate multi-protocol active sweeps, passive ARP snooping, and gateway table extraction.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatusAndLogs}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>

          <button
            onClick={handleTriggerScan}
            disabled={status.is_running || triggering}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-md ${
              status.is_running || triggering
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-95"
            }`}
          >
            {status.is_running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-300" />
                Discovery Sweep Active...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Trigger Network Sweep
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">Scanner Engine</span>
            {status.is_running ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Running
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                Idle
              </span>
            )}
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-white">
              {status.is_running ? "Active Sweep" : "Ready"}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {status.modules_active.length} modules currently armed
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">Last Sweep Completed</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-4">
            <div className="text-xl font-bold text-white">
              {status.last_scan_time ? new Date(status.last_scan_time).toLocaleTimeString() : "Never"}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Duration: {status.last_duration_sec}s
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">Discovered In Last Run</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-white">
              {status.total_discovered} Devices
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Correlated with database
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">Target Range</span>
            <Settings2 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-4">
            <div className="text-lg font-bold text-white truncate">
              {cidr}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ports: {ports}
            </p>
          </div>
        </div>
      </div>

      {/* Configuration & Discovery Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sweep Settings */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-400" />
            Sweep Parameters
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Subnet / CIDR</label>
              <input
                type="text"
                value={cidr}
                onChange={(e) => setCidr(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                placeholder="192.168.1.0/24"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Nmap Port Target List</label>
              <input
                type="text"
                value={ports}
                onChange={(e) => setPorts(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                placeholder="22,80,443,8080"
              />
            </div>
          </div>
        </div>

        {/* Modules Toggle List */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Radar className="w-4 h-4 text-indigo-400" />
            Discovery Protocols & Workers
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const active = status.modules_active.includes(mod.id);
              return (
                <div
                  key={mod.id}
                  onClick={() => handleToggleModule(mod.id)}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    active
                      ? "bg-indigo-950/20 border-indigo-500/40 hover:border-indigo-500"
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700 opacity-60"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${active ? "bg-indigo-600/20 text-indigo-400" : "bg-slate-800 text-slate-400"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-white truncate">{mod.name}</div>
                      <input
                        type="checkbox"
                        checked={active}
                        readOnly
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0 focus:outline-none pointer-events-none"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{mod.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Execution Logs Terminal */}
      <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            Live Discovery Audit & Execution Stream
          </h2>
          <span className="text-xs text-slate-500">Auto-refreshing every 3s</span>
        </div>

        <div className="font-mono text-xs bg-slate-950 border border-slate-800 rounded-lg p-4 h-64 overflow-y-auto space-y-2">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic">No discovery logs recorded yet. Trigger a sweep above.</div>
          ) : (
            logs.map((log, i) => {
              const color =
                log.level === "WARNING"
                  ? "text-amber-400"
                  : log.level === "ERROR"
                  ? "text-rose-400"
                  : "text-slate-300";
              return (
                <div key={i} className="flex items-start gap-3 leading-relaxed">
                  <span className="text-slate-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`font-semibold shrink-0 w-16 ${
                      log.level === "WARNING"
                        ? "text-amber-400"
                        : log.level === "ERROR"
                        ? "text-rose-400"
                        : "text-indigo-400"
                    }`}
                  >
                    [{log.level}]
                  </span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
