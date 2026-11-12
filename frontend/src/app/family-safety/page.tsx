"use client";

import React, { useState, useEffect } from "react";
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

  const selectProfile = (p: ProfileItem) => {
    setActiveProfile(p);
    const pol = p.policies[0];
    if (pol) {
      setSelectedCategories(pol.categories || []);
      setBlockedDomainsInput((pol.blocked_domains || []).join(", "));
      setAllowedDomainsInput((pol.allowed_domains || []).join(", "));
    } else {
      setSelectedCategories(["Adult", "Malware"]);
      setBlockedDomainsInput("");
      setAllowedDomainsInput("");
    }

    const sched = p.schedules[0];
    if (sched) {
      setBedtimeStart(sched.start_time || "21:00");
      setBedtimeEnd(sched.end_time || "07:00");
      setSelectedDays(sched.days_of_week || []);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchAvailableDevices = async () => {
    try {
      const res = await fetch("/api/v1/devices?limit=500&paginate=true");
      if (res.ok) {
        const data = await res.json();
        const devList = data.devices || [];
        setAvailableDevices(devList);
        if (devList.length > 0) {
          setSelectedDeviceToAssign(devList[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch available devices", e);
    }
  };

  const handleAssignDevice = async () => {
    if (!activeProfile || !selectedDeviceToAssign) return;
    try {
      const res = await fetch(`/api/v1/family/profiles/${activeProfile.id}/assign-device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: selectedDeviceToAssign })
      });
      if (res.ok) {
        setAssignModalOpen(false);
        fetchProfiles();
      }
    } catch (e) {
      console.error("Failed to assign device", e);
    }
  };

  const handleUnassignDevice = async (deviceId: string) => {
    if (!activeProfile) return;
    try {
      const res = await fetch(`/api/v1/family/profiles/${activeProfile.id}/devices/${deviceId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchProfiles();
      }
    } catch (e) {
      console.error("Failed to remove device assignment", e);
    }
  };

  const handleTogglePause = async (p: ProfileItem, pause: boolean, durationMinutes?: number) => {
    try {
      await fetch(`/api/v1/family/profiles/${p.id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: pause, duration_minutes: durationMinutes })
      });
      fetchProfiles();
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-400" />
            Family Safety & Transparent Parental Controls
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Household member profiles, one-click Internet Pause, category-based DNS filtering, and bedtime access windows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchProfiles}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        </div>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {profiles.map((p) => {
          const isSelected = activeProfile?.id === p.id;
          return (
            <div
              key={p.id}
              onClick={() => selectProfile(p)}
              className={`p-5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? "bg-slate-800/80 border-indigo-500 shadow-md shadow-indigo-500/10"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white text-base">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white leading-tight">{p.name}</h3>
                    <span className="text-[11px] text-slate-400 font-medium">{p.role}</span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  p.is_paused
                    ? "bg-rose-950/80 text-rose-400 border-rose-800/60"
                    : "bg-emerald-950/80 text-emerald-400 border-emerald-800/60"
                }`}>
                  {p.is_paused ? "PAUSED" : "ONLINE"}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
                <span>{p.devices.length} Devices assigned</span>
                <span>{p.policies.length} Active rules</span>
              </div>

              {/* Quick Pause Action Switch */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-slate-400 font-medium">Internet Access</span>
                <div className="flex items-center gap-1.5">
                  {p.is_paused ? (
                    <button
                      onClick={() => handleTogglePause(p, false)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow transition"
                    >
                      <Play className="w-3.5 h-3.5" /> Resume
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleTogglePause(p, true, 30)}
                        title="Pause for 30 minutes"
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition"
                      >
                        30m
                      </button>
                      <button
                        onClick={() => handleTogglePause(p, true)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold shadow transition"
                      >
                        <Pause className="w-3.5 h-3.5" /> Pause
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Profile Detail Configuration Panel */}
      {activeProfile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assigned Devices */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                Assigned Devices ({activeProfile.devices.length})
              </h3>
              <button
                onClick={() => {
                  fetchAvailableDevices();
                  setAssignModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded text-[11px] font-medium transition"
              >
                <Plus className="w-3.5 h-3.5" /> Assign Device
              </button>
            </div>
            <div className="space-y-2">
              {activeProfile.devices.map((d) => (
                <div key={d.id} className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-200 block">{d.name || "Unnamed Device"}</span>
                    <span className="text-slate-500 font-mono text-[11px]">{d.mac} • {d.ipv4 || "No IP"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      d.status === "online" ? "bg-emerald-950 text-emerald-400" : "bg-slate-800 text-slate-400"
                    }`}>
                      {d.status}
                    </span>
                    <button
                      onClick={() => handleUnassignDevice(d.id)}
                      title="Remove device from profile"
                      className="text-slate-500 hover:text-rose-400 transition p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {activeProfile.devices.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No devices assigned to {activeProfile.name} yet.
                </p>
              )}
            </div>
          </div>

          {/* DNS Policy Categories */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-indigo-400" />
              Domain Category Filters
            </h3>
            <div className="space-y-2 text-xs">
              {CATEGORIES.map((cat) => {
                const isBlocked = selectedCategories.includes(cat);
                return (
                  <label
                    key={cat}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 cursor-pointer hover:bg-slate-800/30 transition"
                  >
                    <span className="text-slate-300 font-medium">{cat}</span>
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
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                  </label>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Custom Blocklist (comma-separated domains)
                </label>
                <input
                  type="text"
                  value={blockedDomainsInput}
                  onChange={(e) => setBlockedDomainsInput(e.target.value)}
                  placeholder="e.g. distracting-site.com, video-game.net"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Custom Allowlist (whitelist overrides)
                </label>
                <input
                  type="text"
                  value={allowedDomainsInput}
                  onChange={(e) => setAllowedDomainsInput(e.target.value)}
                  placeholder="e.g. wikipedia.org, school.edu"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Bedtime Restriction Matrix */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-indigo-400" />
                Bedtime & Study Windows
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Automated DNS curfew: requests will be transparently rejected during the configured time frame.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] text-slate-400 font-semibold mb-1">Bedtime Starts</label>
                  <input
                    type="time"
                    value={bedtimeStart}
                    onChange={(e) => setBedtimeStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 font-semibold mb-1">Access Resumes</label>
                  <input
                    type="time"
                    value={bedtimeEnd}
                    onChange={(e) => setBedtimeEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1.5">Active Days</label>
                <div className="flex gap-1">
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
                        className={`flex-1 py-1 rounded text-[11px] font-bold uppercase transition ${
                          active
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-950 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {day.charAt(0)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-800 mt-5">
              <button
                onClick={handleSavePolicy}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition"
              >
                Save All Profile Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Profile Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-indigo-400" /> Create Member Profile
            </h3>
            <form onSubmit={handleCreateProfile} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Adult">Adult</option>
                  <option value="Child">Child</option>
                  <option value="Teen">Teen</option>
                  <option value="Guest">Guest</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 font-semibold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
            <button
              onClick={() => setAssignModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Smartphone className="w-5 h-5 text-indigo-400" /> Assign Device to {activeProfile?.name}
            </h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Discovered Device</label>
                {availableDevices.length > 0 ? (
                  <select
                    value={selectedDeviceToAssign}
                    onChange={(e) => setSelectedDeviceToAssign(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    {availableDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name || d.mac} ({d.mac}{d.ipv4 ? ` • ${d.ipv4}` : ""})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-slate-400 py-2">No devices discovered yet.</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignDevice}
                  disabled={!selectedDeviceToAssign}
                  className="px-4 py-1.5 bg-indigo-600 disabled:opacity-50 text-white rounded-lg hover:bg-indigo-500 font-semibold"
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

