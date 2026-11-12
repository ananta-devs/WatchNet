"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  Unlock,
  Save,
  Clock,
  Activity,
  History,
  Network,
  Cpu,
  Laptop,
  Smartphone,
  Server,
  Tv,
  HelpCircle,
  Shield,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  Archive,
  RefreshCw
} from "lucide-react";

interface DeviceDetail {
  id: string;
  mac: string;
  ipv4: string | null;
  ipv6: string | null;
  vendor: string | null;
  name: string | null;
  interface: string | null;
  status: "online" | "offline" | "unknown";
  category: string;
  icon: string | null;
  notes: string | null;
  is_archived: boolean;
  locked_fields: string[];
  first_seen: string;
  last_seen: string;
  custom_properties: Record<string, any>;
}

interface PresenceDay {
  date: string;
  hourly_bitmap: number;
  hours: boolean[];
}

interface HistoryData {
  device_id: string;
  mac: string;
  ip_history: string[];
  sessions: Array<{
    id: string;
    start: string;
    end: string | null;
    is_active: boolean;
    duration_seconds: number | null;
  }>;
  events: Array<{
    id: number;
    event_type: string;
    severity: string;
    payload: Record<string, any>;
    timestamp: string;
  }>;
}

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [presence, setPresence] = useState<PresenceDay[]>([]);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form editable states
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Unknown");
  const [icon, setIcon] = useState("help-circle");
  const [notes, setNotes] = useState("");
  const [isArchived, setIsArchived] = useState(false);
  const [lockedFields, setLockedFields] = useState<string[]>([]);

  const fetchDeviceData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [devRes, presRes, histRes] = await Promise.all([
        fetch(`/api/v1/devices/${id}`, { credentials: "include", headers }),
        fetch(`/api/v1/devices/${id}/presence?days=7`, { credentials: "include", headers }),
        fetch(`/api/v1/devices/${id}/history`, { credentials: "include", headers }),
      ]);

      if (devRes.ok) {
        const d: DeviceDetail = await devRes.json();
        setDevice(d);
        setName(d.name || "");
        setCategory(d.category || "Unknown");
        setIcon(d.icon || "help-circle");
        setNotes(d.notes || "");
        setIsArchived(d.is_archived || false);
        setLockedFields(d.locked_fields || []);
      }

      if (presRes.ok) {
        const p = await presRes.json();
        setPresence(p || []);
      }

      if (histRes.ok) {
        const h = await histRes.json();
        setHistory(h);
      }
    } catch (e) {
      console.error("Failed to load device details", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceData();
  }, [id]);

  const toggleLock = (field: string) => {
    setLockedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/devices/${id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({
          name,
          category,
          icon,
          notes,
          is_archived: isArchived,
          locked_fields: lockedFields,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setDevice(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Save error", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
        Loading device telemetry...
      </div>
    );
  }

  if (!device) {
    return (
      <div className="p-8 text-center text-slate-400">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <h2 className="text-lg font-semibold text-white">Device Not Found</h2>
        <p className="text-sm mt-1 mb-4">The device record may have been deleted or does not exist.</p>
        <Link href="/devices" className="text-cyan-400 hover:underline text-sm">
          ← Return to Devices
        </Link>
      </div>
    );
  }

  const isOnline = device.status === "online";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <Link
          href="/devices"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Device Inventory
        </Link>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Changes saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Hero Header */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700/80 text-cyan-400 shadow-inner">
            <Cpu className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{device.name || device.mac}</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isOnline
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                {device.status.toUpperCase()}
              </span>
              {device.is_archived && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Archived
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-2 font-mono">
              <span>MAC: {device.mac}</span>
              <span>•</span>
              <span>IPv4: {device.ipv4 || "—"}</span>
              <span>•</span>
              <span>Vendor: {device.vendor || "Unknown"}</span>
              {device.interface && (
                <>
                  <span>•</span>
                  <span>Interface: {device.interface}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          <div>
            <div className="text-slate-500">First Seen</div>
            <div className="font-medium text-slate-200 mt-0.5">
              {new Date(device.first_seen).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Last Seen</div>
            <div className="font-medium text-slate-200 mt-0.5">
              {new Date(device.last_seen).toLocaleDateString()} {new Date(device.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column = Edit & Lock, Right Column = Heatmap & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Editable Metadata & Field Locks */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Device Identity & Field Locks
            </h2>
            <p className="text-xs text-slate-400">
              Lock fields to prevent network discovery sweeps from overwriting your custom labels.
            </p>

            {/* Device Name Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Friendly Name</label>
                <button
                  type="button"
                  onClick={() => toggleLock("name")}
                  className={`flex items-center gap-1 text-xs transition ${
                    lockedFields.includes("name") ? "text-amber-400" : "text-slate-500 hover:text-slate-400"
                  }`}
                  title="Toggle field lock"
                >
                  {lockedFields.includes("name") ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  {lockedFields.includes("name") ? "Locked" : "Unlocked"}
                </button>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Master Bedroom Smart TV"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>

            {/* Category Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Category</label>
                <button
                  type="button"
                  onClick={() => toggleLock("category")}
                  className={`flex items-center gap-1 text-xs transition ${
                    lockedFields.includes("category") ? "text-amber-400" : "text-slate-500 hover:text-slate-400"
                  }`}
                >
                  {lockedFields.includes("category") ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  {lockedFields.includes("category") ? "Locked" : "Unlocked"}
                </button>
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 transition"
              >
                <option value="Mobile">Mobile</option>
                <option value="Desktop/Laptop">Desktop/Laptop</option>
                <option value="IoT/Smart Home">IoT/Smart Home</option>
                <option value="Network/Infrastructure">Network/Infrastructure</option>
                <option value="Server">Server</option>
                <option value="Gaming/Media">Gaming/Media</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            {/* Notes Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Operator Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add device location, warranty, or owner details..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>

            {/* Active / Archive Toggle */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-300">Archival Status</div>
                <div className="text-xs text-slate-500">Archived devices do not trigger missing alerts</div>
              </div>
              <button
                type="button"
                onClick={() => setIsArchived(!isArchived)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  isArchived
                    ? "bg-amber-950/40 border-amber-800/60 text-amber-300"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {isArchived ? "Archived (Soft Deleted)" : "Active"}
              </button>
            </div>
          </div>

          {/* Custom Properties / Tags Card */}
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-cyan-400" />
              Tags & Heuristic Telemetry
            </h3>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {((device.custom_properties?.tags as string[]) || []).map((t, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-cyan-950/50 border border-cyan-800/50 text-cyan-300 text-xs"
                >
                  #{t}
                </span>
              ))}
              {(!device.custom_properties?.tags || (device.custom_properties.tags as string[]).length === 0) && (
                <span className="text-xs text-slate-500">No tags assigned</span>
              )}
            </div>

            {/* Confidence & Reasons */}
            {device.custom_properties?.classification_confidence && (
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs space-y-1.5">
                <div className="text-slate-400">
                  Classification Confidence:{" "}
                  <span className="text-cyan-400 font-semibold">
                    {Math.round((device.custom_properties.classification_confidence || 0) * 100)}%
                  </span>
                </div>
                {device.custom_properties.classification_reasons && (
                  <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                    {device.custom_properties.classification_reasons.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Hourly Presence Heatmap & Historical Logs */}
        <div className="lg:col-span-7 space-y-6">
          {/* 24-Bit Hourly Presence Matrix Heatmap */}
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  24-Hour Presence Matrix (Past 7 Days)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bitmap matrix of observed device online connectivity per hour.
                </p>
              </div>
            </div>

            {presence.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No presence timeline data recorded yet.
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {/* Hour indicator row */}
                <div className="grid grid-cols-24 gap-1 text-[9px] text-slate-500 font-mono text-center pl-24">
                  {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                    <div key={h} className="col-span-3 text-left">
                      {h}:00
                    </div>
                  ))}
                </div>

                {/* Day rows */}
                {presence.map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-slate-400 font-mono flex-shrink-0">
                      {day.date}
                    </span>
                    <div className="flex-1 grid grid-cols-24 gap-1">
                      {day.hours.map((isOnlineHour, hourIdx) => (
                        <div
                          key={hourIdx}
                          title={`${day.date} at ${hourIdx}:00 - ${isOnlineHour ? "Online" : "Offline"}`}
                          className={`h-5 rounded-sm transition-colors ${
                            isOnlineHour
                              ? "bg-emerald-500 hover:bg-emerald-400"
                              : "bg-slate-800/80 hover:bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* IP History Log & Sessions */}
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              Historical IP Assignments & Session Durations
            </h3>

            {/* IP Address History */}
            <div>
              <div className="text-xs font-medium text-slate-300 mb-2">IP History Log</div>
              <div className="flex flex-wrap gap-2">
                {history?.ip_history.map((ip, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300"
                  >
                    {ip}
                  </span>
                ))}
                {(!history || history.ip_history.length === 0) && (
                  <span className="text-xs text-slate-500 font-mono">No IP history recorded</span>
                )}
              </div>
            </div>

            {/* Recent Sessions */}
            <div className="pt-2">
              <div className="text-xs font-medium text-slate-300 mb-2">Recent Sessions</div>
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Session Start</th>
                      <th className="px-3 py-2">Session End</th>
                      <th className="px-3 py-2">Duration</th>
                      <th className="px-3 py-2">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                    {history?.sessions.slice(0, 5).map((s) => (
                      <tr key={s.id} className="hover:bg-slate-900/50">
                        <td className="px-3 py-2">{new Date(s.start).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          {s.end ? new Date(s.end).toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-cyan-400">
                          {s.duration_seconds
                            ? `${Math.round(s.duration_seconds / 60)} mins`
                            : "Active"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              s.is_active
                                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {s.is_active ? "Active" : "Closed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!history || history.sessions.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                          No sessions logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Network Events Log */}
            <div className="pt-2">
              <div className="text-xs font-medium text-slate-300 mb-2">Correlated Events</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {history?.events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2 rounded bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-cyan-400 font-mono">{evt.event_type}</span>
                      <span className="text-slate-400">{JSON.stringify(evt.payload)}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
