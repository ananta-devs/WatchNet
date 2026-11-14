"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  Unlock,
  Save,
  Clock,
  Activity,
  History,
  Cpu,
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
    timestamp: string;
    payload: any;
  }>;
}

export default function DeviceDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [presence, setPresence] = useState<PresenceDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Unknown");
  const [notes, setNotes] = useState("");
  const [isArchived, setIsArchived] = useState(false);
  const [lockedFields, setLockedFields] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const fetchDeviceData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [devRes, histRes, presRes] = await Promise.all([
        fetch(`/api/v1/devices/${id}`, { headers, credentials: "include" }),
        fetch(`/api/v1/devices/${id}/history`, { headers, credentials: "include" }),
        fetch(`/api/v1/devices/${id}/presence?days=7`, { headers, credentials: "include" })
      ]);

      if (devRes.ok) {
        const devData = await devRes.json();
        setDevice(devData);
        setName(devData.name || "");
        setCategory(devData.category || "Unknown");
        setNotes(devData.notes || "");
        setIsArchived(devData.is_archived || false);
        setLockedFields(devData.locked_fields || []);
        setTags(devData.custom_properties?.tags || []);
      }

      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData);
      }

      if (presRes.ok) {
        const presData = await presRes.json();
        setPresence(presData);
      }
    } catch (e) {
      console.error("Failed to fetch device detail", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceData();
  }, [id]);

  const toggleLock = (field: string) => {
    if (lockedFields.includes(field)) {
      setLockedFields(lockedFields.filter((f) => f !== field));
    } else {
      setLockedFields([...lockedFields, field]);
    }
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    if (!tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((x) => x !== t));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/devices/${id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({
          name: name.trim() || null,
          category,
          notes: notes.trim() || null,
          is_archived: isArchived,
          locked_fields: lockedFields,
          custom_properties: {
            ...(device?.custom_properties || {}),
            tags
          }
        })
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await fetchDeviceData();
      }
    } catch (e) {
      console.error("Failed to save device", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-accent" />
        <p className="text-sm">Loading technical telemetry & history...</p>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="p-8 text-center text-muted">
        <AlertTriangle className="w-8 h-8 text-status-warning mx-auto mb-2" />
        <h2 className="text-lg font-semibold text-text">Device Not Found</h2>
        <p className="text-sm mt-1 mb-4">The device record may have been deleted or does not exist.</p>
        <Link href="/devices" className="text-accent hover:underline text-sm">
          ← Return to Devices
        </Link>
      </div>
    );
  }

  const isOnline = device.status === "online";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-border">
        <Link
          href="/devices"
          className="flex items-center gap-2 text-xs sm:text-sm text-muted hover:text-text transition min-h-[36px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Device Inventory</span>
        </Link>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-status-online font-medium">
              <CheckCircle2 className="w-4 h-4" /> Changes saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs sm:text-sm font-medium transition shadow-xs cursor-pointer min-h-[44px] sm:min-h-[36px]"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Hero Header: Adapts from stacked mobile to side-by-side tablet/desktop */}
      <div className="bg-surface p-4 sm:p-6 rounded-2xl border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 shadow-xs">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="p-3 sm:p-4 rounded-xl bg-hover border border-border text-accent shadow-inner shrink-0">
            <Cpu className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-text tracking-tight break-all">
                {device.name || device.mac}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isOnline
                    ? "bg-status-online/10 text-status-online border border-status-online/20"
                    : "bg-hover text-muted border border-border"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-status-online animate-pulse" : "bg-muted"}`} />
                {device.status.toUpperCase()}
              </span>
              {device.is_archived && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-status-warning/10 text-status-warning border border-status-warning/20">
                  Archived
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted mt-2 font-mono">
              <span className="break-all">MAC: {device.mac}</span>
              <span className="hidden sm:inline">•</span>
              <span>IPv4: {device.ipv4 || "—"}</span>
              <span className="hidden sm:inline">•</span>
              <span className="font-sans">Vendor: {device.vendor || "Unknown"}</span>
              {device.interface && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span>Interface: {device.interface}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs text-muted bg-background/50 p-3 sm:p-4 rounded-xl border border-border w-full md:w-auto shrink-0">
          <div>
            <div className="text-muted text-[10px] uppercase tracking-wider">First Seen</div>
            <div className="font-medium text-text mt-0.5">
              {new Date(device.first_seen).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-muted text-[10px] uppercase tracking-wider">Last Seen</div>
            <div className="font-medium text-text mt-0.5">
              {new Date(device.last_seen).toLocaleDateString()} {new Date(device.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column = Edit & Lock, Right Column = Heatmap & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Form: Editable Metadata & Field Locks */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-6">
          <div className="bg-surface p-4 sm:p-6 rounded-2xl border border-border space-y-4 sm:space-y-5 shadow-xs">
            <h2 className="text-sm sm:text-base font-semibold text-text flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              Device Identity & Field Locks
            </h2>
            <p className="text-xs text-muted">
              Lock fields to prevent network discovery sweeps from overwriting your custom labels.
            </p>

            {/* Device Name Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text">Friendly Name</label>
                <button
                  type="button"
                  onClick={() => toggleLock("name")}
                  className={`flex items-center gap-1 text-xs transition cursor-pointer ${
                    lockedFields.includes("name") ? "text-amber-500 font-semibold" : "text-muted hover:text-text"
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
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition min-h-[38px]"
              />
            </div>

            {/* Category Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text">Category</label>
                <button
                  type="button"
                  onClick={() => toggleLock("category")}
                  className={`flex items-center gap-1 text-xs transition cursor-pointer ${
                    lockedFields.includes("category") ? "text-amber-500 font-semibold" : "text-muted hover:text-text"
                  }`}
                >
                  {lockedFields.includes("category") ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  {lockedFields.includes("category") ? "Locked" : "Unlocked"}
                </button>
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:border-accent transition min-h-[38px]"
              >
                <option value="Mobile">Mobile</option>
                <option value="Desktop/Laptop">Desktop / Laptop</option>
                <option value="IoT/Smart Home">IoT / Smart Home</option>
                <option value="Network/Infrastructure">Network / Infrastructure</option>
                <option value="Server">Server</option>
                <option value="Gaming/Media">Gaming / Media</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            {/* Custom Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text">Administrative Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add deployment notes, room numbers, rack ID, or VLAN details..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition"
              />
            </div>

            {/* Tags Input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-text flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-accent" />
                Custom Tags
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  placeholder="e.g. static-dhcp, critical-infra"
                  className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-text placeholder-muted focus:outline-none focus:border-accent min-h-[36px]"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-1.5 bg-hover hover:bg-border text-text rounded-lg text-xs font-medium border border-border cursor-pointer min-h-[36px]"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-hover border border-border text-xs text-text font-medium"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-muted hover:text-status-critical ml-1 text-sm font-bold"
                      aria-label={`Remove tag ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Archive Device Toggle */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-text block">Archive Device</span>
                <span className="text-[11px] text-muted">Hide from primary active inventory</span>
              </div>
              <button
                type="button"
                onClick={() => setIsArchived(!isArchived)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer min-h-[36px] ${
                  isArchived
                    ? "bg-status-warning/10 border-status-warning/30 text-status-warning"
                    : "bg-surface border-border text-muted hover:text-text"
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                {isArchived ? "Archived" : "Active"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Hourly Presence Heatmap & Historical Logs */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-6">
          {/* 24-Bit Hourly Presence Matrix Heatmap */}
          <div className="bg-surface p-4 sm:p-6 rounded-2xl border border-border space-y-3 sm:space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-text flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  24-Hour Presence Matrix (Past 7 Days)
                </h3>
                <p className="text-[11px] sm:text-xs text-muted mt-0.5">
                  Bitmap matrix of observed device online connectivity per hour.
                </p>
              </div>
            </div>

            {presence.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                No presence timeline data recorded yet.
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3 pt-2 overflow-x-auto">
                {/* Min-width container guarantees bitmap does not crush on 320px mobile */}
                <div className="min-w-[420px]">
                  {/* Hour indicator row */}
                  <div className="grid grid-cols-24 gap-1 text-[9px] text-muted font-mono text-center pl-20 sm:pl-24 mb-1">
                    {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                      <div key={h} className="col-span-3 text-left">
                        {h}:00
                      </div>
                    ))}
                  </div>

                  {/* Day rows */}
                  {presence.map((day) => (
                    <div key={day.date} className="flex items-center gap-2 sm:gap-3 py-0.5">
                      <span className="w-16 sm:w-20 text-[11px] sm:text-xs text-muted font-mono shrink-0">
                        {day.date}
                      </span>
                      <div className="flex-1 grid grid-cols-24 gap-1">
                        {day.hours.map((isOnlineHour, hourIdx) => (
                          <div
                            key={hourIdx}
                            title={`${day.date} at ${hourIdx}:00 - ${isOnlineHour ? "Online" : "Offline"}`}
                            className={`h-4 sm:h-5 rounded-xs sm:rounded-sm transition-colors ${
                              isOnlineHour
                                ? "bg-status-online hover:opacity-80"
                                : "bg-hover hover:bg-border"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* IP History Log & Sessions */}
          <div className="bg-surface p-4 sm:p-6 rounded-2xl border border-border space-y-4 shadow-xs">
            <h3 className="text-xs sm:text-sm font-semibold text-text flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              Historical IP Assignments & Session Durations
            </h3>

            {/* IP Address History */}
            <div>
              <div className="text-xs font-medium text-text mb-2">IP History Log</div>
              <div className="flex flex-wrap gap-2">
                {history?.ip_history.map((ip, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded bg-background border border-border text-xs font-mono text-text"
                  >
                    {ip}
                  </span>
                ))}
                {(!history || history.ip_history.length === 0) && (
                  <span className="text-xs text-muted font-mono">No IP history recorded</span>
                )}
              </div>
            </div>

            {/* Recent Sessions */}
            <div className="pt-2">
              <div className="text-xs font-medium text-text mb-2">Recent Sessions</div>
              <div className="overflow-x-auto rounded-lg border border-border bg-background">
                <table className="w-full text-left text-xs">
                  <thead className="bg-hover text-muted border-b border-border">
                    <tr>
                      <th className="px-3 py-2 whitespace-nowrap">Session Start</th>
                      <th className="px-3 py-2 whitespace-nowrap">Session End</th>
                      <th className="px-3 py-2 whitespace-nowrap">Duration</th>
                      <th className="px-3 py-2 whitespace-nowrap">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-text font-mono">
                    {history?.sessions.slice(0, 5).map((s) => (
                      <tr key={s.id} className="hover:bg-hover transition">
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(s.start).toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {s.end ? new Date(s.end).toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-accent font-semibold whitespace-nowrap">
                          {s.duration_seconds
                            ? `${Math.round(s.duration_seconds / 60)} mins`
                            : "Active"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              s.is_active
                                ? "bg-status-online/10 text-status-online border border-status-online/20"
                                : "bg-hover text-muted"
                            }`}
                          >
                            {s.is_active ? "Active" : "Closed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!history || history.sessions.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-muted">
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
              <div className="text-xs font-medium text-text mb-2">Correlated Events</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {history?.events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2 rounded bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-accent font-mono shrink-0">{evt.event_type}</span>
                      <span className="text-muted truncate">{JSON.stringify(evt.payload)}</span>
                    </div>
                    <span className="text-[10px] text-muted font-mono shrink-0 self-end sm:self-auto">
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
