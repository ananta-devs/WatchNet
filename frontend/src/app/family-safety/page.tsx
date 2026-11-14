"use client";

import React, { useState, useEffect } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  Users,
  Plus,
  RefreshCw,
  Pause,
  Play,
  Shield,
  Smartphone,
  Clock,
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  X
} from "lucide-react";

interface ProfileItem {
  id: string;
  name: string;
  role: string;
  avatar: string;
  is_paused: boolean;
  pause_until: string | null;
  devices: Array<{
    id: string;
    mac: string;
    name: string;
    ipv4: string;
    status: string;
  }>;
  policies: Array<{
    id: string;
    name: string;
    categories: string[];
    blocked_domains: string[];
    allowed_domains: string[];
    is_active: boolean;
  }>;
  schedules: Array<{
    id: string;
    name: string;
    days_of_week: string[];
    start_time: string;
    end_time: string;
    is_active: boolean;
  }>;
}

const CATEGORIES = ["Adult", "Gambling", "Social Media", "Malware", "Gaming"];

export default function FamilySafetyPage() {
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProfile, setActiveProfile] = useState<ProfileItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<Array<{ id: string; name: string | null; mac: string; ipv4: string | null }>>([]);
  const [selectedDeviceToAssign, setSelectedDeviceToAssign] = useState<string>("");
  const [temporaryPassOpen, setTemporaryPassOpen] = useState<string | null>(null);

  useScrollLock(createModalOpen || assignModalOpen || Boolean(temporaryPassOpen));

  // New profile state
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Child");

  // Policy editing state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [blockedDomainsInput, setBlockedDomainsInput] = useState("");
  const [allowedDomainsInput, setAllowedDomainsInput] = useState("");
  
  // Bedtime state
  const [bedtimeStart, setBedtimeStart] = useState("21:00");
  const [bedtimeEnd, setBedtimeEnd] = useState("07:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/family/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
        if (data.length > 0 && !activeProfile) {
          selectProfile(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableDevices = async () => {
    try {
      const res = await fetch("/api/v1/devices?limit=100");
      if (res.ok) {
        const data = await res.json();
        const devs = Array.isArray(data) ? data : data.devices || [];
        setAvailableDevices(devs);
        if (devs.length > 0) {
          setSelectedDeviceToAssign(devs[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectProfile = (p: ProfileItem) => {
    setActiveProfile(p);
    if (p.policies && p.policies.length > 0) {
      setSelectedCategories(p.policies[0].categories || []);
      setBlockedDomainsInput((p.policies[0].blocked_domains || []).join(", "));
      setAllowedDomainsInput((p.policies[0].allowed_domains || []).join(", "));
    } else {
      setSelectedCategories([]);
      setBlockedDomainsInput("");
      setAllowedDomainsInput("");
    }
    if (p.schedules && p.schedules.length > 0) {
      setBedtimeStart(p.schedules[0].start_time || "21:00");
      setBedtimeEnd(p.schedules[0].end_time || "07:00");
      setSelectedDays(p.schedules[0].days_of_week || []);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleTogglePause = async (profileId: string, currentPaused: boolean) => {
    try {
      const res = await fetch(`/api/v1/family/profiles/${profileId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !currentPaused })
      });
      if (res.ok) {
        fetchProfiles();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGrantTemporaryPass = async (profileId: string, durationMinutes: number) => {
    try {
      const res = await fetch(`/api/v1/family/profiles/${profileId}/temporary-pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration_minutes: durationMinutes })
      });
      if (res.ok) {
        setTemporaryPassOpen(null);
        fetchProfiles();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/family/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, role: newRole })
      });
      if (res.ok) {
        setCreateModalOpen(false);
        setNewName("");
        fetchProfiles();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignDevice = async () => {
    if (!activeProfile || !selectedDeviceToAssign) return;
    try {
      const res = await fetch(`/api/v1/family/profiles/${activeProfile.id}/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: selectedDeviceToAssign })
      });
      if (res.ok) {
        setAssignModalOpen(false);
        fetchProfiles();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnassignDevice = async (deviceId: string) => {
    if (!activeProfile) return;
    try {
      await fetch(`/api/v1/family/profiles/${activeProfile.id}/devices/${deviceId}`, {
        method: "DELETE"
      });
      fetchProfiles();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePolicy = async () => {
    if (!activeProfile) return;
    try {
      const blocked = blockedDomainsInput.split(",").map((s) => s.trim()).filter(Boolean);
      const allowed = allowedDomainsInput.split(",").map((s) => s.trim()).filter(Boolean);

      // Save DNS policy
      await fetch(`/api/v1/family/profiles/${activeProfile.id}/policies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${activeProfile.name} Safety Policy`,
          categories: selectedCategories,
          blocked_domains: blocked,
          allowed_domains: allowed,
          is_active: true
        })
      });

      // Save Bedtime schedule
      await fetch(`/api/v1/family/profiles/${activeProfile.id}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bedtime Restriction",
          days_of_week: selectedDays,
          start_time: bedtimeStart,
          end_time: bedtimeEnd,
          is_active: true
        })
      });

      alert("Policy & Bedtime schedule updated successfully!");
      fetchProfiles();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text flex items-center gap-2">
            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-accent shrink-0" />
            <span>Family Safety & Transparent Parental Controls</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Household member profiles, one-click Internet Pause, category-based DNS filtering, and bedtime access windows.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={fetchProfiles}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3 py-2 bg-surface hover:bg-hover text-text text-xs sm:text-sm font-medium rounded-lg border border-border transition min-h-[38px] cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs sm:text-sm font-medium rounded-lg shadow-xs transition min-h-[38px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        </div>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {profiles.map((p) => {
          const isSelected = activeProfile?.id === p.id;
          return (
            <div
              key={p.id}
              onClick={() => selectProfile(p)}
              className={`p-4 sm:p-5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? "bg-accent/10 border-accent ring-1 ring-accent/30 shadow-xs"
                  : "bg-surface border-border hover:bg-hover shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-white text-base shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-text leading-tight truncate">{p.name}</h3>
                    <span className="text-[11px] text-muted font-medium">{p.role}</span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border shrink-0 ${
                  p.is_paused
                    ? "bg-status-critical/10 text-status-critical border-status-critical/20"
                    : "bg-status-online/10 text-status-online border-status-online/20"
                }`}>
                  {p.is_paused ? "PAUSED" : "ACTIVE"}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
                <span>{p.devices.length} Devices assigned</span>
                <span className="text-accent font-medium flex items-center gap-0.5">
                  Inspect <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>

              {/* Pause / Temporary Pass controls */}
              <div className="mt-3 pt-2.5 border-t border-border/80 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleTogglePause(p.id, p.is_paused)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer min-h-[36px] ${
                    p.is_paused
                      ? "bg-status-online/10 text-status-online hover:bg-status-online/20 border border-status-online/30"
                      : "bg-status-critical/10 text-status-critical hover:bg-status-critical/20 border border-status-critical/30"
                  }`}
                >
                  {p.is_paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  {p.is_paused ? "Resume" : "Pause Net"}
                </button>
                <button
                  onClick={() => setTemporaryPassOpen(p.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-hover text-text border border-border text-xs font-medium transition cursor-pointer min-h-[36px]"
                >
                  Temp Pass
                </button>
              </div>

              {/* Temporary Pass Drawer */}
              {temporaryPassOpen === p.id && (
                <div className="mt-2 p-2 bg-background border border-border rounded-lg text-xs space-y-1.5 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center text-[10px] text-muted font-semibold uppercase">
                    <span>Grant Pass Duration</span>
                    <button onClick={() => setTemporaryPassOpen(null)} className="text-muted hover:text-text cursor-pointer">×</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[15, 30, 60].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => handleGrantTemporaryPass(p.id, mins)}
                        className="py-1 bg-surface hover:bg-hover text-text rounded border border-border text-[11px] font-medium cursor-pointer"
                      >
                        +{mins}m
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Profile Detailed Controls */}
      {activeProfile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Assigned Devices */}
          <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-text flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-accent" />
                Assigned Devices ({activeProfile.devices.length})
              </h3>
              <button
                onClick={() => {
                  fetchAvailableDevices();
                  setAssignModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-accent hover:bg-accent-hover text-white rounded text-[11px] font-medium transition cursor-pointer min-h-[32px]"
              >
                <Plus className="w-3.5 h-3.5" /> Assign Device
              </button>
            </div>
            <div className="space-y-2">
              {activeProfile.devices.map((d) => (
                <div key={d.id} className="p-3 bg-background/50 rounded-lg border border-border flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-text block truncate">{d.name || "Unnamed Device"}</span>
                    <span className="text-muted font-mono text-[11px] truncate block">{d.mac} • {d.ipv4 || "No IP"}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      d.status === "online" ? "bg-status-online/10 text-status-online border border-status-online/20" : "bg-hover text-muted"
                    }`}>
                      {d.status}
                    </span>
                    <button
                      onClick={() => handleUnassignDevice(d.id)}
                      title="Remove device from profile"
                      className="text-muted hover:text-status-critical transition p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {activeProfile.devices.length === 0 && (
                <p className="text-xs text-muted py-4 text-center">
                  No devices assigned to {activeProfile.name} yet.
                </p>
              )}
            </div>
          </div>

          {/* DNS Policy Categories */}
          <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 shadow-xs">
            <h3 className="text-xs sm:text-sm font-semibold text-text flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-accent" />
              Domain Category Filters
            </h3>
            <div className="space-y-2 text-xs">
              {CATEGORIES.map((cat) => {
                const isBlocked = selectedCategories.includes(cat);
                return (
                  <label
                    key={cat}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border cursor-pointer hover:bg-hover transition min-h-[38px]"
                  >
                    <span className="text-text font-medium">{cat}</span>
                    <input
                      type="checkbox"
                      checked={isBlocked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories([...selectedCategories, cat]);
                        } else {
                          setSelectedCategories(selectedCategories.filter((c) => c !== cat));
                        }
                      }}
                      className="rounded bg-surface border-border text-accent focus:ring-0"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-border space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Custom Blocklist (comma-separated domains)
                </label>
                <input
                  type="text"
                  value={blockedDomainsInput}
                  onChange={(e) => setBlockedDomainsInput(e.target.value)}
                  placeholder="e.g. distracting-site.com, video-game.net"
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs text-text placeholder-muted focus:outline-none focus:border-accent min-h-[36px]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Custom Allowlist (whitelist overrides)
                </label>
                <input
                  type="text"
                  value={allowedDomainsInput}
                  onChange={(e) => setAllowedDomainsInput(e.target.value)}
                  placeholder="e.g. wikipedia.org, school.edu"
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs text-text placeholder-muted focus:outline-none focus:border-accent min-h-[36px]"
                />
              </div>
            </div>
          </div>

          {/* Bedtime Restriction Matrix */}
          <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-text flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-accent" />
                Bedtime & Study Windows
              </h3>
              <p className="text-xs text-muted mb-4">
                Automated DNS curfew: requests will be transparently rejected during the configured time frame.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] text-muted font-semibold mb-1">Bedtime Starts</label>
                  <input
                    type="time"
                    value={bedtimeStart}
                    onChange={(e) => setBedtimeStart(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-accent min-h-[36px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted font-semibold mb-1">Access Resumes</label>
                  <input
                    type="time"
                    value={bedtimeEnd}
                    onChange={(e) => setBedtimeEnd(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-accent min-h-[36px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-muted font-semibold mb-1.5">Active Days</label>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => {
                    const active = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (active) setSelectedDays(selectedDays.filter((d) => d !== day));
                          else setSelectedDays([...selectedDays, day]);
                        }}
                        className={`flex-1 py-1.5 rounded text-[11px] font-bold uppercase transition cursor-pointer min-h-[36px] ${
                          active
                            ? "bg-accent text-white"
                            : "bg-background text-muted hover:text-text border border-border"
                        }`}
                      >
                        {day.charAt(0)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border mt-4">
              <button
                onClick={handleSavePolicy}
                className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer min-h-[40px]"
              >
                Save All Profile Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Profile Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-text cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base sm:text-lg font-bold text-text flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-accent" /> Create Member Profile
            </h3>
            <form onSubmit={handleCreateProfile} className="space-y-4 text-xs">
              <div>
                <label className="block text-text font-semibold mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-text font-semibold mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent min-h-[38px]"
                >
                  <option value="Adult">Adult</option>
                  <option value="Child">Child</option>
                  <option value="Teen">Teen</option>
                  <option value="Guest">Guest</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3.5 py-2 bg-surface hover:bg-hover text-text rounded-lg border border-border font-medium cursor-pointer min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover font-semibold shadow-xs cursor-pointer min-h-[38px]"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Device Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setAssignModalOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-text cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base sm:text-lg font-bold text-text flex items-center gap-2 mb-4">
              <Smartphone className="w-5 h-5 text-accent" /> Assign Device to {activeProfile?.name}
            </h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-text font-semibold mb-1">Select Discovered Device</label>
                {availableDevices.length > 0 ? (
                  <select
                    value={selectedDeviceToAssign}
                    onChange={(e) => setSelectedDeviceToAssign(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:border-accent min-h-[38px]"
                  >
                    {availableDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name || d.mac} ({d.mac}{d.ipv4 ? ` • ${d.ipv4}` : ""})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-muted py-2">No devices discovered yet.</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-3.5 py-2 bg-surface hover:bg-hover text-text rounded-lg border border-border font-medium cursor-pointer min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignDevice}
                  disabled={!selectedDeviceToAssign}
                  className="px-4 py-2 bg-accent disabled:opacity-50 text-white rounded-lg hover:bg-accent-hover font-semibold shadow-xs cursor-pointer min-h-[38px]"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
