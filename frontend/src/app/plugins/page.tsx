"use client";

import React, { useState, useEffect } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  Boxes,
  Play,
  Settings,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Layers,
  ChevronRight,
  X
} from "lucide-react";

interface PluginRecord {
  plugin_id: string;
  name: string;
  category: string;
  description: string;
  is_enabled: boolean;
  schedule_interval_sec: number;
  last_run_at: string | null;
  last_status: string;
  config_json: Record<string, any>;
  error_message: string | null;
  config_schema: {
    title?: string;
    description?: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

interface PluginLog {
  id: number;
  plugin_id: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number;
  status: string;
  items_produced: number;
  log_output: string;
  error: string | null;
}

const CATEGORIES = [
  { id: "all", label: "All Plugins" },
  { id: "discovery", label: "Discovery & Routers" },
  { id: "name_resolution", label: "Name Resolution" },
  { id: "monitoring", label: "Monitoring" },
  { id: "notification", label: "Notifications" },
  { id: "system", label: "System Utilities" },
];

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Settings Modal State
  const [editingPlugin, setEditingPlugin] = useState<PluginRecord | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [scheduleInterval, setScheduleInterval] = useState<number>(300);
  const [savingConfig, setSavingConfig] = useState(false);

  // Logs Drawer State
  const [viewingLogsPlugin, setViewingLogsPlugin] = useState<PluginRecord | null>(null);
  const [logs, setLogs] = useState<PluginLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useScrollLock(Boolean(editingPlugin || viewingLogsPlugin));

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchPlugins = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/plugins", {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPlugins(data);
      }
    } catch (err) {
      console.error("Failed to load plugins:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const handleToggle = async (plugin: PluginRecord) => {
    try {
      const res = await fetch(`/api/v1/plugins/${plugin.plugin_id}/toggle`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ is_enabled: !plugin.is_enabled }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlugins((prev) =>
          prev.map((p) => (p.plugin_id === updated.plugin_id ? updated : p))
        );
      }
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  const handleRunNow = async (plugin: PluginRecord) => {
    try {
      setRunningPluginId(plugin.plugin_id);
      setActionFeedback(`Executing ${plugin.name}...`);
      const res = await fetch(`/api/v1/plugins/${plugin.plugin_id}/run`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ parameters: {} }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback(`Successfully finished ${plugin.name} (${data.items_produced} items processed)`);
      } else {
        setActionFeedback(`Failed running ${plugin.name}: ${data.error || "Execution error"}`);
      }
      await fetchPlugins();
    } catch (err: any) {
      setActionFeedback(`Error running ${plugin.name}: ${err.message}`);
    } finally {
      setRunningPluginId(null);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const openSettings = (plugin: PluginRecord) => {
    setEditingPlugin(plugin);
    setFormData(plugin.config_json || {});
    setScheduleInterval(plugin.schedule_interval_sec || 300);
  };

  const handleSaveConfig = async () => {
    if (!editingPlugin) return;
    try {
      setSavingConfig(true);
      const res = await fetch(`/api/v1/plugins/${editingPlugin.plugin_id}/config`, {
        method: "PUT",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
          config: formData,
          schedule_interval_sec: scheduleInterval,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlugins((prev) =>
          prev.map((p) => (p.plugin_id === updated.plugin_id ? updated : p))
        );
        setEditingPlugin(null);
      } else {
        const errData = await res.json();
        alert(`Config error: ${errData.detail || "Validation failed"}`);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setSavingConfig(false);
    }
  };

  const openLogsDrawer = async (plugin: PluginRecord) => {
    setViewingLogsPlugin(plugin);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/v1/plugins/${plugin.plugin_id}/logs?limit=20`, {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to load plugin logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const filteredPlugins = plugins.filter((p) => {
    const matchesCategory =
      selectedCategory === "all" || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.plugin_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getStatusBadge = (plugin: PluginRecord) => {
    if (!plugin.is_enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-hover text-muted border border-border">
          Disabled
        </span>
      );
    }
    if (plugin.last_status === "running") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Running
        </span>
      );
    }
    if (plugin.last_status === "error" || plugin.last_status === "failed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-critical/10 text-status-critical border border-rose-500/20">
          <XCircle className="w-3 h-3" />
          Error
        </span>
      );
    }
    if (plugin.last_status === "timeout") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3" />
          Timeout
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-online/10 text-status-online border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" />
        Active
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text flex items-center gap-3">
            <Boxes className="w-7 h-7 text-accent" />
            Plugins & Integration Framework
          </h1>
          <p className="text-sm text-muted mt-1">
            Enterprise modular adapters for routers, DNS telemetry, active discovery, monitors, and alerts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPlugins}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-hover text-xs font-medium text-text transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionFeedback && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-300 text-sm">
          <span>{actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} className="text-accent hover:text-indigo-900 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-surface border border-border rounded-lg shadow-sm">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? "bg-indigo-600 text-white"
                  : "text-muted hover:text-slate-900 dark:hover:text-slate-200 hover:bg-hover"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Search plugins by name, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-text placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-accent shadow-sm"
          />
        </div>
      </div>

      {/* Plugins Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm">Loading registered plugins...</p>
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="text-center p-12 border border-dashed border-border rounded-xl bg-white dark:bg-transparent">
          <Boxes className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-muted">No plugins found matching criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlugins.map((plugin) => (
            <div
              key={plugin.plugin_id}
              className={`flex flex-col justify-between p-5 rounded-xl border bg-surface backdrop-blur-sm transition-all shadow-sm ${
                plugin.is_enabled
                  ? "border-border hover:border-slate-300 dark:hover:border-slate-700"
                  : "border-border/60 opacity-70"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text text-base">
                        {plugin.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-hover text-muted border border-border">
                        {plugin.plugin_id}
                      </span>
                    </div>
                    <span className="inline-block mt-1 text-[11px] uppercase tracking-wider text-accent font-semibold">
                      {plugin.category.replace("_", " ")}
                    </span>
                  </div>

                  {/* Enable Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plugin.is_enabled}
                      onChange={() => handleToggle(plugin)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <p className="text-xs text-muted mt-2.5 line-clamp-2">
                  {plugin.description}
                </p>

                {/* Status & Last Run Info */}
                <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between text-xs">
                  <div>{getStatusBadge(plugin)}</div>
                  <div className="text-[11px] text-muted">
                    {plugin.last_run_at
                      ? `Ran ${new Date(plugin.last_run_at).toLocaleTimeString()}`
                      : "Never run"}
                  </div>
                </div>

                {plugin.error_message && (
                  <div className="mt-2 text-[11px] text-status-critical bg-rose-50 dark:bg-status-critical/10 px-2 py-1 rounded border border-rose-200 dark:border-rose-500/20 line-clamp-1">
                    {plugin.error_message}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-3 border-t border-border/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openSettings(plugin)}
                    className="p-1.5 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/60 hover:bg-hover text-text transition-colors"
                    title="Configure Plugin Settings"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openLogsDrawer(plugin)}
                    className="p-1.5 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/60 hover:bg-hover text-text transition-colors"
                    title="View Execution Logs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => handleRunNow(plugin)}
                  disabled={runningPluginId === plugin.plugin_id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-medium transition-colors shadow-sm"
                >
                  <Play className={`w-3.5 h-3.5 ${runningPluginId === plugin.plugin_id ? "animate-spin" : ""}`} />
                  Run Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plugin Settings Modal */}
      {editingPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
              <div>
                <h3 className="font-semibold text-text text-base">
                  {editingPlugin.name} Configuration
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Adapter Identifier: <code className="text-accent">{editingPlugin.plugin_id}</code>
                </p>
              </div>
              <button
                onClick={() => setEditingPlugin(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Schedule Interval Field */}
              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Schedule Interval (Seconds)
                </label>
                <input
                  type="number"
                  min={10}
                  max={86400}
                  value={scheduleInterval}
                  onChange={(e) => setScheduleInterval(parseInt(e.target.value) || 300)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Interval at which the scheduler automatically dispatches this plugin (default: 300s).
                </p>
              </div>

              {/* Dynamic Form based on schema properties */}
              {editingPlugin.config_schema?.properties &&
                Object.entries(editingPlugin.config_schema.properties).map(([key, prop]: [string, any]) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-text mb-1">
                      {prop.title || key}
                    </label>
                    {prop.type === "boolean" ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formData[key]}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, [key]: e.target.checked }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    ) : (
                      <input
                        type={prop.type === "integer" || prop.type === "number" ? "number" : "text"}
                        value={formData[key] ?? ""}
                        placeholder={prop.default !== undefined ? String(prop.default) : ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [key]:
                              prop.type === "integer" || prop.type === "number"
                                ? parseFloat(e.target.value) || 0
                                : e.target.value,
                          }))
                        }
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-text placeholder-slate-400 focus:outline-none focus:border-accent"
                      />
                    )}
                    {prop.description && (
                      <p className="text-[11px] text-slate-500 mt-1">{prop.description}</p>
                    )}
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-background/50">
              <button
                onClick={() => setEditingPlugin(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-text hover:bg-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-xs font-medium text-white transition-colors shadow-sm"
              >
                {savingConfig ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Log Drawer */}
      {viewingLogsPlugin && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border-l border-border w-full max-w-xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/60">
              <div>
                <h3 className="font-semibold text-text text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" />
                  {viewingLogsPlugin.name} Logs
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Execution history and telemetry output
                </p>
              </div>
              <button
                onClick={() => setViewingLogsPlugin(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {loadingLogs ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                  <p className="text-xs">Fetching logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-border rounded-lg text-slate-500 text-xs">
                  No execution logs recorded yet.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-lg bg-background border border-border/80 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-muted">
                        {new Date(log.started_at).toLocaleString()}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                          log.status === "success"
                            ? "bg-emerald-50 dark:bg-status-online/10 text-emerald-700 dark:text-status-online border border-emerald-200 dark:border-emerald-500/20"
                            : "bg-rose-50 dark:bg-status-critical/10 text-rose-700 dark:text-status-critical border border-rose-200 dark:border-rose-500/20"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Duration: <strong className="text-text">{log.duration_ms}ms</strong></span>
                      <span>Items: <strong className="text-text">{log.items_produced}</strong></span>
                    </div>

                    {log.log_output && (
                      <pre className="p-2.5 rounded bg-surface border border-border text-[11px] font-mono text-text overflow-x-auto whitespace-pre-wrap">
                        {log.log_output}
                      </pre>
                    )}

                    {log.error && (
                      <div className="p-2.5 rounded bg-rose-50 dark:bg-status-critical/10 border border-rose-200 dark:border-rose-500/20 text-[11px] font-mono text-rose-700 dark:text-rose-300">
                        {log.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
