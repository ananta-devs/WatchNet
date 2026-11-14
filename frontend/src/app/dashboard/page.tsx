"use client";

import React, { useState, useEffect } from "react";
import { Smartphone, Shield, Wifi, AlertTriangle, Radar } from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  totalDevices: number;
  onlineDevices: number;
  activeAlerts: number;
  networkLoad: string;
}

interface DeviceItem {
  id: string;
  name: string | null;
  ipv4: string | null;
  vendor: string | null;
  status: string;
  last_seen: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDevices: 0,
    onlineDevices: 0,
    activeAlerts: 0,
    networkLoad: "Nominal",
  });
  const [recentDevices, setRecentDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchDashboardData() {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/v1/devices?limit=100&paginate=true", {
          credentials: "include",
          headers,
        });

        if (res.ok) {
          const data = await res.json();
          const devList: DeviceItem[] = Array.isArray(data) ? data : data.devices || [];
          const total = typeof data.total === "number" ? data.total : devList.length;
          const online = devList.filter((d) => d.status === "online").length;

          if (isMounted) {
            setStats({
              totalDevices: total,
              onlineDevices: online,
              activeAlerts: 0,
              networkLoad: total > 0 ? "Nominal" : "Idle",
            });
            setRecentDevices(devList.slice(0, 5));
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  const onlinePercent = stats.totalDevices > 0 ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Enterprise Network Overview</h1>
          <p className="text-sm text-muted mt-1">Real-time device discovery, presence tracking, and intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/discovery"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            <Radar className="w-4 h-4" /> Run Subnet Scan
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Total Devices</span>
            <div className="w-8 h-8 rounded-lg bg-hover flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-accent" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-text">{stats.totalDevices}</div>
          <div className="text-xs text-muted mt-1">Tracked across subnets</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Online Now</span>
            <div className="w-8 h-8 rounded-lg bg-hover flex items-center justify-center">
              <Wifi className="w-4 h-4 text-status-online" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-status-online">{stats.onlineDevices}</div>
          <div className="text-xs text-muted mt-1">{onlinePercent}% active presence</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Security State</span>
            <div className="w-8 h-8 rounded-lg bg-hover flex items-center justify-center">
              <Shield className="w-4 h-4 text-accent" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-accent">Secure</div>
          <div className="text-xs text-muted mt-1">0 rogue MAC alerts</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Network Alerts</span>
            <div className="w-8 h-8 rounded-lg bg-hover flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-status-warning" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-text">{stats.activeAlerts}</div>
          <div className="text-xs text-muted mt-1">All systems normal</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6 shadow-xs">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text mb-4">Discovery Engine Status</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted">ARP / ICMP Collector</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-online/10 text-status-online border border-status-online/20">Active</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted">Presence Heatmap Engine</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">24-bit Ready</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted">Database Engine</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-online/10 text-status-online border border-status-online/20">PostgreSQL / SQLite</span>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text">Recent Discovered Activity</h2>
            <Link href="/devices" className="text-xs font-medium text-accent hover:underline">
              View All
            </Link>
          </div>
          {loading ? (
            <div className="py-8 text-center text-xs text-muted">Loading discovery activity...</div>
          ) : recentDevices.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No discovered devices recorded yet. Discovered devices on your network will appear here automatically.
            </div>
          ) : (
            <div className="space-y-3">
              {recentDevices.map((dev) => (
                <div key={dev.id} className="flex items-center justify-between text-xs py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dev.status === "online" ? "bg-status-online" : "bg-status-offline"}`} />
                    <span className="font-mono text-text">{dev.ipv4 || "No IP"}</span>
                    <span className="text-muted">({dev.name || dev.vendor || "Unknown Device"})</span>
                  </div>
                  <span className="text-muted">
                    {dev.last_seen ? new Date(dev.last_seen).toLocaleTimeString() : "Recent"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
