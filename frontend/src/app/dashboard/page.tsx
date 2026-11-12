"use client";

import React, { useState } from "react";
import { Smartphone, Shield, Wifi, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  const [stats] = useState({
    totalDevices: 12,
    onlineDevices: 8,
    activeAlerts: 0,
    networkLoad: "Nominal",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Enterprise Network Overview</h1>
        <p className="text-sm text-slate-400 mt-1">Real-time device discovery, presence tracking, and intelligence</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Devices</span>
            <Smartphone className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold">{stats.totalDevices}</div>
          <div className="text-xs text-slate-500 mt-1">Tracked across subnets</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Online Now</span>
            <Wifi className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400">{stats.onlineDevices}</div>
          <div className="text-xs text-slate-500 mt-1">66% active presence</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Security State</span>
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-indigo-400">Secure</div>
          <div className="text-xs text-slate-500 mt-1">0 rogue MAC alerts</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Network Alerts</span>
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-bold">{stats.activeAlerts}</div>
          <div className="text-xs text-slate-500 mt-1">All systems normal</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Discovery Engine Status</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300">ARP / ICMP Collector</span>
              <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300">Presence Heatmap Engine</span>
              <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">24-bit Ready</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-300">PostgreSQL Partitioning</span>
              <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Monthly Rotation</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Recent Discovered Activity</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-mono text-slate-300">192.168.1.1</span>
                <span className="text-slate-500">(Gateway Router)</span>
              </div>
              <span className="text-slate-500">Just now</span>
            </div>
            <div className="flex items-center justify-between text-xs py-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-mono text-slate-300">192.168.1.45</span>
                <span className="text-slate-500">(Apple iPhone)</span>
              </div>
              <span className="text-slate-500">2m ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
