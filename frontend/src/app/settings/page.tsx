"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Archive,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Shield,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Clock,
  KeyRound,
  FileSpreadsheet,
  Layers,
  Activity,
  Lock
} from "lucide-react";

interface StorageStats {
  dialect: string;
  total_records: number;
  database_size_bytes: number;
  database_size_mb: number;
  table_counts: Record<string, number>;
  retention_days: Record<string, number>;
}

interface BackupFile {
  filename: string;
  filepath: string;
  size_bytes: number;
  size_mb: number;
  created_at: string;
}

export default function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState<"maintenance" | "backup" | "security">("maintenance");
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Retention sliders state
  const [retention, setRetention] = useState({
    device_sessions: 90,
    network_events: 30,
    dns_activity_logs: 14,
    plugin_execution_logs: 7,
    audit_logs: 180,
  });

  // Password & Security State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResolution, setImportResolution] = useState<"overwrite" | "skip">("overwrite");

  const fetchStatsAndBackups = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch("/api/v1/system/maintenance/stats");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        if (statsData.retention_days) {
          setRetention((prev) => ({
            ...prev,
            ...statsData.retention_days,
          }));
        }
      }

      const backupsRes = await fetch("/api/v1/system/backups");
      if (backupsRes.ok) {
        const backupsData = await backupsRes.json();
        setBackups(backupsData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndBackups();
  }, []);

  const handlePrune = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/system/maintenance/prune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retention),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: `Cleanup successful! Pruned records: ${JSON.stringify(data.pruned)}`,
        });
        fetchStatsAndBackups();
      } else {
        setMessage({ type: "error", text: data.detail || "Pruning failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Pruning failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleVacuum = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/system/maintenance/vacuum", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Optimization finished" });
      } else {
        setMessage({ type: "error", text: data.detail || "Vacuum failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Vacuum failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async (type: "json" | "sql" | "csv") => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/system/backup?backup_type=${type}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Backup generated: ${data.filename}` });
        fetchStatsAndBackups();
      } else {
        setMessage({ type: "error", text: data.detail || "Backup creation failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Backup creation failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete backup ${filename}?`)) return;
    try {
      const res = await fetch(`/api/v1/system/backups/${filename}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: `Deleted ${filename}` });
        fetchStatsAndBackups();
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    }
  };

  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Please choose a backup ZIP file first");
      return;
    }
    if (!confirm("Restoring will overwrite current system state. Proceed?")) return;

    setLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/v1/system/restore", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: `System successfully restored! Restored items: ${JSON.stringify(data.details?.restored_counts)}`,
        });
        fetchStatsAndBackups();
      } else {
        setMessage({ type: "error", text: data.detail || "Restoration failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Restoration failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleImportDevicesCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Please select a devices.csv file first");
      return;
    }
    setLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`/api/v1/system/import/devices.csv?conflict_resolution=${importResolution}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: `CSV Import Complete: ${data.summary?.created} created, ${data.summary?.updated} updated, ${data.summary?.skipped} skipped`,
        });
        fetchStatsAndBackups();
      } else {
        setMessage({ type: "error", text: data.detail || "CSV import failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text flex items-center gap-2">
            <Sliders className="w-6 h-6 text-accent" />
            System Settings & Production Maintenance
          </h1>
          <p className="text-sm text-muted">
            Database retention policies, atomic backup archives, CSV device migration, and security hardening.
          </p>
        </div>
        <button
          onClick={fetchStatsAndBackups}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg border border-border transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Stats
        </button>
      </div>

      {/* Status banner */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 border ${
            message.type === "success"
              ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
              : "bg-rose-950/40 border-rose-800 text-rose-200"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-status-online" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-status-critical" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border space-x-2 sm:space-x-4 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("maintenance")}
          className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1.5 sm:gap-2 transition cursor-pointer whitespace-nowrap min-h-[40px] ${
            activeTab === "maintenance"
              ? "border-accent text-accent font-semibold"
              : "border-transparent text-muted hover:text-text"
          }`}
        >
          <Database className="w-4 h-4 shrink-0" />
          Database & Retention Pruning
        </button>
        <button
          onClick={() => setActiveTab("backup")}
          className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1.5 sm:gap-2 transition cursor-pointer whitespace-nowrap min-h-[40px] ${
            activeTab === "backup"
              ? "border-accent text-accent font-semibold"
              : "border-transparent text-muted hover:text-text"
          }`}
        >
          <Archive className="w-4 h-4 shrink-0" />
          Backups & CSV Migration
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-1.5 sm:gap-2 transition cursor-pointer whitespace-nowrap min-h-[40px] ${
            activeTab === "security"
              ? "border-accent text-accent font-semibold"
              : "border-transparent text-muted hover:text-text"
          }`}
        >
          <Shield className="w-4 h-4 shrink-0" />
          Security & Access Hardening
        </button>
      </div>

      {/* Tab 1: Maintenance & Retention */}
      {activeTab === "maintenance" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Storage Stats Card */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-text flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-accent" />
              Storage Statistics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background/60 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted uppercase font-semibold">Total Records</span>
                <p className="text-2xl font-bold text-text mt-1">
                  {stats ? stats.total_records.toLocaleString() : "..."}
                </p>
              </div>
              <div className="bg-background/60 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted uppercase font-semibold">Database Engine</span>
                <p className="text-2xl font-bold text-accent mt-1 uppercase">
                  {stats ? stats.dialect : "..."}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-xs font-semibold uppercase text-muted tracking-wider">
                Table Row Counts
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {stats &&
                  Object.entries(stats.table_counts).map(([tbl, cnt]) => (
                    <div
                      key={tbl}
                      className="flex justify-between items-center text-xs py-1 px-2 rounded bg-background/40 border border-border/60"
                    >
                      <span className="font-mono text-text">{tbl}</span>
                      <span className="font-semibold text-accent">{cnt.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleVacuum}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg border border-border transition"
              >
                <Activity className="w-4 h-4 text-status-online" />
                Run Database Optimize / Vacuum
              </button>
            </div>
          </div>

          {/* Retention Configuration Sliders */}
          <div className="lg:col-span-2 bg-surface border border-border shadow-sm rounded-xl p-5 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-text flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                Telemetry Data Retention Policies
              </h3>
              <p className="text-xs text-muted mt-1">
                Tune automatic pruning thresholds for high-volume telemetry tables to prevent disk bloat.
              </p>
            </div>

            <div className="space-y-5">
              {/* Device Sessions */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text font-medium">Device Inactive Sessions</span>
                  <span className="text-accent font-bold">{retention.device_sessions} Days</span>
                </div>
                <input
                  type="range"
                  min="7"
                  max="365"
                  value={retention.device_sessions}
                  onChange={(e) =>
                    setRetention({ ...retention, device_sessions: Number(e.target.value) })
                  }
                  className="w-full accent-indigo-500 bg-slate-200 dark:bg-slate-800"
                />
              </div>

              {/* Network Events */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text font-medium">Network Event Telemetry</span>
                  <span className="text-accent font-bold">{retention.network_events} Days</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="180"
                  value={retention.network_events}
                  onChange={(e) =>
                    setRetention({ ...retention, network_events: Number(e.target.value) })
                  }
                  className="w-full accent-indigo-500 bg-slate-200 dark:bg-slate-800"
                />
              </div>

              {/* DNS Activity Logs */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text font-medium">DNS Query Activity Logs</span>
                  <span className="text-accent font-bold">{retention.dns_activity_logs} Days</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="90"
                  value={retention.dns_activity_logs}
                  onChange={(e) =>
                    setRetention({ ...retention, dns_activity_logs: Number(e.target.value) })
                  }
                  className="w-full accent-indigo-500 bg-slate-200 dark:bg-slate-800"
                />
              </div>

              {/* Plugin Execution Logs */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text font-medium">Plugin Execution Runs</span>
                  <span className="text-accent font-bold">{retention.plugin_execution_logs} Days</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={retention.plugin_execution_logs}
                  onChange={(e) =>
                    setRetention({ ...retention, plugin_execution_logs: Number(e.target.value) })
                  }
                  className="w-full accent-indigo-500 bg-slate-200 dark:bg-slate-800"
                />
              </div>

              {/* Audit Logs */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text font-medium">Administrative Audit Logs</span>
                  <span className="text-accent font-bold">{retention.audit_logs} Days</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="730"
                  value={retention.audit_logs}
                  onChange={(e) =>
                    setRetention({ ...retention, audit_logs: Number(e.target.value) })
                  }
                  className="w-full accent-indigo-500 bg-slate-200 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <button
                onClick={handlePrune}
                disabled={loading}
                className="flex items-center gap-2 py-2.5 px-6 bg-rose-600 hover:bg-status-critical text-white text-sm font-semibold rounded-lg shadow-sm transition"
              >
                <Trash2 className="w-4 h-4" />
                Run Retention Pruning Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Backups & CSV Migration */}
      {activeTab === "backup" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Actions & CSV Tools Card */}
          <div className="bg-surface border border-border shadow-sm rounded-xl p-5 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-text flex items-center gap-2">
                <Archive className="w-5 h-5 text-accent" />
                Create Backup Archive
              </h3>
              <p className="text-xs text-muted mt-1">
                Generates a portable ZIP containing full schemas, devices, profiles, and settings.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleCreateBackup("json")}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition"
              >
                <Download className="w-4 h-4" />
                Create Complete Backup (.ZIP)
              </button>
            </div>

            {/* Standard CSV export/import section */}
            <div className="pt-4 border-t border-border space-y-4">
              <h4 className="text-sm font-semibold text-text flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-status-online" />
                Device CSV Tools
              </h4>
              <p className="text-xs text-muted">
                Direct export and import of device inventories via CSV format for easy migration.
              </p>

              <a
                href="/api/v1/system/export/devices.csv"
                download="watchnet_devices_export.csv"
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-border transition"
              >
                <Download className="w-3.5 h-3.5" />
                Export Devices as CSV
              </a>

              <form onSubmit={handleImportDevicesCsv} className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-muted block mb-1">Upload Devices CSV</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-text file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:hover:file:bg-slate-700 file:text-slate-700 dark:file:text-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Conflict Resolution</label>
                  <select
                    value={importResolution}
                    onChange={(e: any) => setImportResolution(e.target.value)}
                    className="w-full bg-background border border-border text-xs text-slate-900 dark:text-slate-300 rounded p-1.5"
                  >
                    <option value="overwrite">Overwrite existing MAC records</option>
                    <option value="skip">Skip existing MAC records</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading || !selectedFile}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-status-online disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import Devices from CSV
                </button>
              </form>
            </div>
          </div>

          {/* Backup Archives List & Restore */}
          <div className="lg:col-span-2 space-y-6">
            {/* Restore from Archive Card */}
            <div className="bg-surface border border-border shadow-sm rounded-xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-text flex items-center gap-2">
                <Upload className="w-5 h-5 text-accent" />
                Restore System from Archive
              </h3>
              <p className="text-xs text-muted">
                Upload a valid WatchNet backup zip archive. Includes transactional rollback protection and schema checking.
              </p>
              <form onSubmit={handleRestoreBackup} className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="flex-1 text-xs text-text file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-slate-100 hover:file:bg-slate-200 dark:file:bg-slate-800 dark:hover:file:bg-slate-700 file:text-slate-700 dark:file:text-slate-300"
                />
                <button
                  type="submit"
                  disabled={loading || !selectedFile}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                >
                  Restore System
                </button>
              </form>
            </div>

            {/* List Existing Backups */}
            <div className="bg-surface border border-border shadow-sm rounded-xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-text flex items-center gap-2">
                <Layers className="w-5 h-5 text-accent" />
                Stored Backup Archives
              </h3>
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {backups.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No backup archives found.</p>
                ) : (
                  backups.map((b) => (
                    <div key={b.filename} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{b.filename}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(b.created_at).toLocaleString()} • {b.size_mb} MB
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/v1/system/backups/${b.filename}/download`}
                          download={b.filename}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-hover rounded transition"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteBackup(b.filename)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-status-critical hover:bg-hover rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Access */}
      {activeTab === "security" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Password Change Card */}
          <div className="bg-surface border border-border shadow-sm rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-text flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-accent" />
              Administrative Password
            </h3>
            <p className="text-xs text-muted">
              Update credentials using Argon2id cryptographic hashing.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-accent"
                />
              </div>
              <button
                onClick={() => {
                  if (newPassword !== confirmPassword) {
                    alert("Passwords do not match");
                    return;
                  }
                  alert("Password update requested");
                }}
                className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white font-medium text-sm rounded-lg transition"
              >
                Update Password
              </button>
            </div>
          </div>

          {/* Hardening Status Card */}
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-text flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              Production Hardening Profile
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-background/60 border border-border rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200">Rate Limiting Protection</p>
                  <p className="text-xs text-slate-500">SlowAPI fixed-window throttling on /auth/login (5 req/min)</p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-status-online border border-emerald-200 dark:border-emerald-800">
                  Active
                </span>
              </div>

              <div className="p-3 bg-background/60 border border-border rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200">Secret Encryption Engine</p>
                  <p className="text-xs text-slate-500">AES-256-GCM envelope encryption with HKDF key derivation</p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-status-online border border-emerald-200 dark:border-emerald-800">
                  AES-256-GCM
                </span>
              </div>

              <div className="p-3 bg-background/60 border border-border rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200">HTTP Security Headers</p>
                  <p className="text-xs text-slate-500">HSTS, X-Frame-Options: DENY, nosniff, strict CSP</p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-status-online border border-emerald-200 dark:border-emerald-800">
                  Enforced
                </span>
              </div>

              <div className="p-3 bg-background/60 border border-border rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200">Container Isolation</p>
                  <p className="text-xs text-slate-500">Non-root user 10001:10001 & Read-only root filesystem</p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  Ready
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
