"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Globe,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  Minimize2,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";

interface WallboardStats {
  wan_ip: string;
  is_connected: boolean;
  gateway_latency_ms: number;
  dns_resolution_ms: number;
  total_devices: number;
  online_devices: number;
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
  active_alerts: number;
  monitored_sites_up: number;
  monitored_sites_total: number;
}

export default function WallboardPage() {
  const [stats, setStats] = useState<WallboardStats>({
    wan_ip: "Probing...",
    is_connected: true,
    gateway_latency_ms: 0,
    dns_resolution_ms: 0,
    total_devices: 0,
    online_devices: 0,
    download_mbps: 0,
    upload_mbps: 0,
    ping_ms: 0,
    active_alerts: 0,
    monitored_sites_up: 0,
    monitored_sites_total: 0,
  });

  const [currentTime, setCurrentTime] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toTimeString().split(" ")[0]);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchLiveTelemetry = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [intRes, speedRes, sitesRes, devRes] = await Promise.all([
        fetch("/api/v1/monitoring/internet", { headers, credentials: "include" }),
        fetch("/api/v1/monitoring/speedtest/history?limit=1", { headers, credentials: "include" }),
        fetch("/api/v1/monitoring/websites", { headers, credentials: "include" }),
        fetch("/api/v1/devices?limit=100", { headers, credentials: "include" })
      ]);

      let wanIp = "Auto-probing...";
      let isConnected = true;
      let gwLatency = 0;
      let dnsLatency = 0;
      if (intRes.ok) {
        const intData = await intRes.json();
        wanIp = intData.wan_ip || "Online";
        isConnected = intData.is_connected ?? true;
        gwLatency = intData.gateway_latency_ms || 0;
        dnsLatency = intData.dns_resolution_ms || 0;
      }

      let down = 0;
      let up = 0;
      let ping = 0;
      if (speedRes.ok) {
        const spData = await speedRes.json();
        if (Array.isArray(spData) && spData.length > 0) {
          down = spData[0].download_mbps || 0;
          up = spData[0].upload_mbps || 0;
          ping = spData[0].ping_ms || 0;
        }
      }

      let sitesUp = 0;
      let sitesTotal = 0;
      if (sitesRes.ok) {
        const siteData = await sitesRes.json();
        if (Array.isArray(siteData)) {
          sitesTotal = siteData.length;
          sitesUp = siteData.filter((s) => s.is_up).length;
        }
      }

      let totalDev = 0;
      let onlineDev = 0;
      if (devRes.ok) {
        const devData = await devRes.json();
        const list = Array.isArray(devData) ? devData : devData.devices || [];
        totalDev = typeof devData.total === "number" ? devData.total : list.length;
        onlineDev = list.filter((d: any) => d.status === "online").length;
      }

      setStats({
        wan_ip: wanIp,
        is_connected: isConnected,
        gateway_latency_ms: gwLatency,
        dns_resolution_ms: dnsLatency,
        total_devices: totalDev,
        online_devices: onlineDev,
        download_mbps: down,
        upload_mbps: up,
        ping_ms: ping,
        active_alerts: 0,
        monitored_sites_up: sitesUp,
        monitored_sites_total: sitesTotal,
      });
    } catch (e) {
      console.error("Telemetry fetch failed", e);
    }
  };

  useEffect(() => {
    fetchLiveTelemetry();
    const interval = setInterval(fetchLiveTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-background text-text p-3.5 sm:p-6 flex flex-col justify-between select-none transition-colors">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-3 sm:pb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-accent animate-pulse shrink-0" />
          <div>
            <h1 className="text-base sm:text-xl font-black tracking-widest uppercase text-text">
              WATCHNET &bull; NETWORK OPERATIONS CENTER
            </h1>
            <p className="text-[10px] sm:text-xs text-muted font-mono tracking-wide">
              REAL-TIME HIGH-CONTRAST TELEMETRY WALLBOARD
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-6">
          <div className="text-left sm:text-right font-mono">
            <div className="text-xl sm:text-2xl font-black text-accent">{currentTime}</div>
            <div className="text-[10px] text-muted uppercase tracking-widest">LOCAL CLOCK</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-surface border border-border shadow-xs hover:bg-hover text-text transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            <Link
              href="/monitoring"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface hover:bg-hover text-text border border-border transition flex items-center gap-1.5 min-h-[36px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Big Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 my-4 sm:my-6 flex-1 items-stretch">
        {/* WAN & Uplink Card */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-muted">WAN Uplink Status</span>
            <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
          </div>
          <div className="my-3 sm:my-4">
            <div className="flex items-center gap-3">
              <span
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full ${
                  stats.is_connected ? "bg-status-online shadow-sm" : "bg-status-critical"
                }`}
              />
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-text">
                {stats.is_connected ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div className="text-xs sm:text-sm font-mono text-muted mt-2 truncate">Public WAN: {stats.wan_ip}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 sm:pt-4 border-t border-border font-mono">
            <div>
              <span className="text-[10px] sm:text-[11px] text-muted block uppercase">GATEWAY RTT</span>
              <span className="text-lg sm:text-xl font-bold text-text">{stats.gateway_latency_ms} ms</span>
            </div>
            <div>
              <span className="text-[10px] sm:text-[11px] text-muted block uppercase">DNS RESOLVE</span>
              <span className="text-lg sm:text-xl font-bold text-text">{stats.dns_resolution_ms} ms</span>
            </div>
          </div>
        </div>

        {/* Speed & Throughput Card */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-muted">WAN Bandwidth</span>
            <Gauge className="w-5 h-5 sm:w-6 sm:h-6 text-status-online" />
          </div>
          <div className="my-3 sm:my-4 grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted font-bold uppercase">
                <ArrowDownRight className="w-3.5 h-3.5 text-status-online" /> Download
              </div>
              <div className="text-3xl sm:text-4xl font-black text-status-online mt-1 font-mono">
                {stats.download_mbps}
              </div>
              <span className="text-[11px] sm:text-xs text-muted">Mbps</span>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted font-bold uppercase">
                <ArrowUpRight className="w-3.5 h-3.5 text-accent" /> Upload
              </div>
              <div className="text-3xl sm:text-4xl font-black text-accent mt-1 font-mono">
                {stats.upload_mbps}
              </div>
              <span className="text-[11px] sm:text-xs text-muted">Mbps</span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-3 sm:pt-4 border-t border-border font-mono text-xs sm:text-sm">
            <span className="text-muted">BACKBONE PING:</span>
            <span className="text-status-online font-bold">{stats.ping_ms} ms</span>
          </div>
        </div>

        {/* Endpoint & Device Health */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-muted">LAN & Endpoint Health</span>
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
          </div>
          <div className="my-3 sm:my-4 grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <span className="text-[11px] sm:text-xs text-muted block uppercase font-bold">Online Devices</span>
              <div className="text-3xl sm:text-4xl font-black text-status-online mt-1 font-mono">
                {stats.online_devices}
              </div>
              <span className="text-[11px] sm:text-xs text-muted">of {stats.total_devices} total</span>
            </div>
            <div>
              <span className="text-[11px] sm:text-xs text-muted block uppercase font-bold">Web Targets UP</span>
              <div className="text-3xl sm:text-4xl font-black text-accent mt-1 font-mono">
                {stats.monitored_sites_up}
              </div>
              <span className="text-[11px] sm:text-xs text-muted">of {stats.monitored_sites_total} checked</span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-3 sm:pt-4 border-t border-border font-mono text-xs sm:text-sm">
            <span className="text-muted">SYSTEM ALERTS:</span>
            <span className="text-status-online font-bold">0 ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Bottom Footer Telemetry Ticker */}
      <div className="p-3 bg-surface border border-border rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-online animate-ping" />
          <span>AUTOREFRESH INTERVAL: 5000 MS</span>
        </div>
        <div className="text-[11px] sm:text-xs text-center sm:text-right">
          ENTERPRISE NETWORK INTELLIGENCE &bull; WATCHNET PLATFORM v1.0.0-RC.1
        </div>
      </div>
    </div>
  );
}
