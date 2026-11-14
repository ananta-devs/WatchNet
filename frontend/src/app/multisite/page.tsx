"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  Globe,
  Plus,
  RefreshCw,
  Server,
  MapPin,
  Clock,
  Shield,
  Copy,
  Check,
  Activity,
  Laptop,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Terminal,
  Filter,
  X
} from "lucide-react";

interface RemoteSiteNode {
  id: string;
  name: string;
  location: string | null;
  interface: string | null;
  is_active: boolean;
  status: "ONLINE" | "OFFLINE" | "NEVER_CONNECTED";
  device_count: number;
  last_seen: string | null;
  created_at: string | null;
}

export default function MultiSitePage() {
  const [nodes, setNodes] = useState<RemoteSiteNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useScrollLock(modalOpen);

  // Form State
  const [siteName, setSiteName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [siteInterface, setSiteInterface] = useState("eth0");
  const [registrationResult, setRegistrationResult] = useState<{
    site: RemoteSiteNode;
    apiKey: string;
  } | null>(null);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/sync/nodes", { headers });
      if (res.ok) {
        const data = await res.json();
        setNodes(Array.isArray(data) ? data : []);
      } else {
        setNodes([]);
      }
    } catch {
      setNodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const handleRegisterSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName) return;

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/sync/register", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: siteName,
          location: siteLocation || null,
          interface: siteInterface || "eth0"
        })
      });

      if (res.ok) {
        const data = await res.json();
        setRegistrationResult({
          site: {
            id: data.id,
            name: data.name,
            location: data.location,
            interface: data.interface,
            is_active: true,
            status: "NEVER_CONNECTED",
            device_count: 0,
            last_seen: null,
            created_at: new Date().toISOString()
          },
          apiKey: data.api_key
        });
        fetchNodes();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to register site");
      }
    } catch (err: any) {
      alert("Registration error: " + err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const filteredNodes = nodes.filter((n) => {
    if (selectedSiteFilter === "all") return true;
    if (selectedSiteFilter === "online") return n.status === "ONLINE";
    if (selectedSiteFilter === "offline") return n.status !== "ONLINE";
    return true;
  });

  const totalDevices = nodes.reduce((sum, n) => sum + (n.device_count || 0), 0);
  const onlineSites = nodes.filter((n) => n.status === "ONLINE").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-text">
            <Globe className="w-7 h-7 text-accent" />
            Multi-Site & Distributed Collectors
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Centrally manage remote branch offices, distributed Go agents, and cloud telemetry sync
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchNodes}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:hover:bg-slate-700 border border-border transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setRegistrationResult(null);
              setSiteName("");
              setSiteLocation("");
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Add Remote Site
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-surface shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Registered Sites</span>
            <Server className="w-5 h-5 text-accent" />
          </div>
          <p className="text-2xl font-bold text-text mt-2">{nodes.length}</p>
          <span className="text-[11px] text-slate-500">Across all branch locations</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Connected Hubs</span>
            <Activity className="w-5 h-5 text-status-online" />
          </div>
          <p className="text-2xl font-bold text-status-online mt-2">
            {onlineSites} / {nodes.length}
          </p>
          <span className="text-[11px] text-emerald-500/80">Active heartbeat within 5m</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Aggregated Devices</span>
            <Laptop className="w-5 h-5 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-text mt-2">{totalDevices}</p>
          <span className="text-[11px] text-slate-500">Tracked by all distributed collectors</span>
        </div>
      </div>

      {/* Filter and Overview */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          Site Nodes Directory
        </h2>
        <div className="flex items-center gap-2">
          {["all", "online", "offline"].map((f) => (
            <button
              key={f}
              onClick={() => setSelectedSiteFilter(f)}
              className={`px-3 py-1 text-xs rounded-md capitalize transition ${
                selectedSiteFilter === f
                  ? "bg-slate-800 text-accent font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Site Cards Grid */}
      {filteredNodes.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border bg-slate-50/50 dark:bg-slate-900/30">
          <Server className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No remote sites enrolled yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Enroll distributed Go collectors using the &ldquo;Add Remote Site&rdquo; button above to aggregate multi-site branch telemetry.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNodes.map((site) => {
            const isOnline = site.status === "ONLINE";
            return (
              <div
                key={site.id}
                className="p-5 rounded-xl border border-border bg-surface hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          isOnline ? "bg-emerald-400 animate-pulse" : "bg-status-critical"
                        }`}
                      />
                      <h3 className="font-semibold text-slate-200 text-sm leading-tight">{site.name}</h3>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isOnline
                          ? "bg-status-online/10 text-status-online border border-emerald-500/20"
                          : "bg-status-critical/10 text-status-critical border border-rose-500/20"
                      }`}
                    >
                      {site.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span>{site.location || "Remote Deployment"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-slate-500" />
                      <span>Interface: {site.interface || "eth0"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        Last sync: {site.last_seen ? new Date(site.last_seen).toLocaleTimeString() : "Never"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Devices</span>
                    <p className="text-base font-bold text-text">{site.device_count}</p>
                  </div>
                  <Link
                    href={`/devices?site_id=${site.id}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text border border-border transition"
                  >
                    View Inventory
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Site Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {!registrationResult ? (
              <form onSubmit={handleRegisterSite} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-accent" />
                  <h3 className="text-lg font-bold text-text">Register Remote Collector Node</h3>
                </div>
                <p className="text-xs text-muted">
                  Generate authentication tokens for a standalone Go collector daemon running at a remote branch.
                </p>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">Site / Branch Name</label>
                  <input
                    type="text"
                    required
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="e.g. Branch Office London"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-text placeholder-slate-400 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">Physical Location</label>
                  <input
                    type="text"
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                    placeholder="e.g. London, UK (Building 4)"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-text placeholder-slate-400 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">Default Interface</label>
                  <input
                    type="text"
                    value={siteInterface}
                    onChange={(e) => setSiteInterface(e.target.value)}
                    placeholder="eth0 or wlan0"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-text placeholder-slate-400 focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text border border-border transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-sm"
                  >
                    Generate Credentials
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-status-online">
                  <CheckCircle2 className="w-6 h-6" />
                  <h3 className="text-lg font-bold text-text">Site Registered Successfully!</h3>
                </div>

                <div className="p-4 rounded-xl bg-background border border-border space-y-3">
                  <div>
                    <span className="text-[11px] text-muted font-medium">Site API Key (Secret)</span>
                    <div className="flex items-center justify-between gap-2 mt-1 p-2 bg-surface rounded-lg border border-border">
                      <code className="text-xs text-status-warning font-mono break-all">
                        {registrationResult.apiKey}
                      </code>
                      <button
                        onClick={() => copyToClipboard(registrationResult.apiKey)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded"
                        title="Copy Key"
                      >
                        {copiedKey ? <Check className="w-4 h-4 text-status-online" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-muted font-medium">Remote Go Collector CLI Command:</span>
                    <pre className="mt-1 p-3 bg-surface rounded-lg border border-border text-[11px] font-mono text-indigo-700 dark:text-indigo-300 overflow-x-auto">
{`./watchnet-collector \\
  --hub-url="http://central-watchnet:8000" \\
  --api-key="${registrationResult.apiKey}" \\
  --interface="${registrationResult.site.interface || "eth0"}"`}
                    </pre>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    Store this key safely now. It cannot be retrieved again after closing this window.
                  </span>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      setRegistrationResult(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

