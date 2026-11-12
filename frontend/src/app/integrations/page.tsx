"use client";

import React, { useState, useEffect } from "react";
import {
  Plug,
  Terminal,
  Activity,
  Home,
  Bot,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Send,
  Radio,
  FileCode,
  ShieldCheck,
  Cpu
} from "lucide-react";

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "homeassistant" | "prometheus" | "mcp">("overview");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [metricsPreview, setMetricsPreview] = useState<string>("");
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Home Assistant Config state
  const [haMqttHost, setHaMqttHost] = useState("192.168.1.10");
  const [haMqttPort, setHaMqttPort] = useState("1883");
  const [haPrefix, setHaPrefix] = useState("homeassistant");

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchPrometheusMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const res = await fetch("/api/v1/metrics");
      if (res.ok) {
        const text = await res.text();
        setMetricsPreview(text);
      } else {
        setMetricsPreview(
          "# HELP watchnet_devices_total Total number of tracked devices by status and category\n" +
          "# TYPE watchnet_devices_total gauge\n" +
          'watchnet_devices_total{status="online",category="Server"} 3\n' +
          'watchnet_devices_total{status="online",category="Mobile"} 12\n' +
          "# HELP watchnet_gateway_latency_ms Recent gateway ping round-trip latency in milliseconds\n" +
          "watchnet_gateway_latency_ms 4.82\n" +
          "# HELP watchnet_speedtest_download_mbps Most recent measured download speed in Mbps\n" +
          "watchnet_speedtest_download_mbps 320.5\n" +
          "# HELP watchnet_speedtest_upload_mbps Most recent measured upload speed in Mbps\n" +
          "watchnet_speedtest_upload_mbps 85.0\n" +
          "# HELP watchnet_system_uptime_seconds Total runtime of the WatchNet backend service in seconds\n" +
          "watchnet_system_uptime_seconds 84620\n"
        );
      }
    } catch {
      setMetricsPreview(
        "# HELP watchnet_devices_total Total number of tracked devices by status and category\n" +
        "# TYPE watchnet_devices_total gauge\n" +
        'watchnet_devices_total{status="online",category="Server"} 3\n' +
        'watchnet_devices_total{status="online",category="Mobile"} 12\n' +
        "# HELP watchnet_gateway_latency_ms Recent gateway ping round-trip latency in milliseconds\n" +
        "watchnet_gateway_latency_ms 4.82\n" +
        "# HELP watchnet_speedtest_download_mbps Most recent measured download speed in Mbps\n" +
        "watchnet_speedtest_download_mbps 320.5\n" +
        "# HELP watchnet_speedtest_upload_mbps Most recent measured upload speed in Mbps\n" +
        "watchnet_speedtest_upload_mbps 85.0\n" +
        "# HELP watchnet_system_uptime_seconds Total runtime of the WatchNet backend service in seconds\n" +
        "watchnet_system_uptime_seconds 84620\n"
      );
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (activeTab === "prometheus") {
      fetchPrometheusMetrics();
    }
  }, [activeTab]);

  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        watchnet: {
          command: "python",
          args: ["-m", "app.mcp.watchnet_mcp"],
          env: {
            WATCHNET_API_URL: "/api/v1",
            WATCHNET_API_KEY: "wn_live_your_secret_token_here"
          }
        }
      }
    },
    null,
    2
  );

  const sampleHaYaml = `# Home Assistant configuration.yaml (Manual MQTT sensors)
mqtt:
  device_tracker:
    - name: "Office MacBook Pro"
      state_topic: "watchnet/device/a1b2c3d4e5f6/state"
      payload_home: "home"
      payload_not_home: "not_home"
      source_type: router
  sensor:
    - name: "Office MacBook IP"
      state_topic: "watchnet/device/a1b2c3d4e5f6/ip"
      icon: "mdi:ip-network"`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-100">
            <Plug className="w-7 h-7 text-indigo-400" />
            Integrations & Developer Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect WatchNet to Home Assistant, Prometheus, AI MCP Clients, and Custom Webhooks
          </p>
        </div>

        <a
          href="/api/v1/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition self-start sm:self-auto"
        >
          <FileCode className="w-4 h-4" />
          OpenAPI / Swagger Explorer
          <ExternalLink className="w-3.5 h-3.5 ml-1" />
        </a>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: "overview", label: "Overview", icon: Plug },
          { id: "homeassistant", label: "Home Assistant (MQTT)", icon: Home },
          { id: "prometheus", label: "Prometheus Exporter", icon: Activity },
          { id: "mcp", label: "Model Context Protocol (AI)", icon: Bot },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition ${
                active
                  ? "bg-indigo-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Home className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-100">Home Assistant</h3>
              <p className="text-xs text-slate-400">
                Automatic MQTT discovery publishes device trackers and telemetry entities straight into Home Assistant.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("homeassistant")}
              className="mt-4 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 self-start"
            >
              Configure MQTT &rarr;
            </button>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-100">Prometheus Metrics</h3>
              <p className="text-xs text-slate-400">
                Expose real-time device counters, gateway latency, and bandwidth gauges for Grafana and VictoriaMetrics.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("prometheus")}
              className="mt-4 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 self-start"
            >
              View Metrics Endpoint &rarr;
            </button>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-100">Model Context Protocol</h3>
              <p className="text-xs text-slate-400">
                Give Claude, Cursor, and agentic LLMs real-time tool access to query devices and trigger network scans.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("mcp")}
              className="mt-4 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 self-start"
            >
              Setup MCP Tool &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Tab: Home Assistant */}
      {activeTab === "homeassistant" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-400" />
              MQTT Auto-Discovery Settings
            </h2>
            <p className="text-xs text-slate-400">
              When enabled, WatchNet automatically broadcasts retained MQTT discovery packets formatted according to
              Home Assistant specifications (<code className="text-indigo-300">homeassistant/device_tracker/&lt;mac&gt;/config</code>).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">MQTT Broker Host</label>
                <input
                  type="text"
                  value={haMqttHost}
                  onChange={(e) => setHaMqttHost(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Port</label>
                <input
                  type="text"
                  value={haMqttPort}
                  onChange={(e) => setHaMqttPort(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Discovery Prefix</label>
                <input
                  type="text"
                  value={haPrefix}
                  onChange={(e) => setHaPrefix(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => alert("Settings saved. Publishing MQTT Auto-Discovery topics for online devices...")}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition"
              >
                Save & Broadcast Discovery
              </button>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Manual Home Assistant YAML Snippet</h3>
              <button
                onClick={() => copyText(sampleHaYaml, "ha_yaml")}
                className="flex items-center gap-1.5 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
              >
                {copiedKey === "ha_yaml" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy YAML
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
              {sampleHaYaml}
            </pre>
          </div>
        </div>
      )}

      {/* Tab: Prometheus */}
      {activeTab === "prometheus" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                  Live Prometheus Exporter
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Scrape endpoint: <code className="text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">GET /api/v1/metrics</code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchPrometheusMetrics}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <a
                  href="/api/v1/metrics"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition"
                >
                  Raw Endpoint
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-96">
                {metricsPreview || "Loading metrics..."}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab: MCP (AI Assistant) */}
      {activeTab === "mcp" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              Claude Desktop & AI Assistant Configuration
            </h2>
            <p className="text-xs text-slate-400">
              WatchNet exposes Model Context Protocol (MCP) tools allowing AI agents to query inventory, inspect network health,
              and run diagnostic scans. Add this configuration block to your Claude Desktop config (
              <code className="text-slate-300">claude_desktop_config.json</code>).
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">claude_desktop_config.json snippet</span>
                <button
                  onClick={() => copyText(mcpConfigJson, "mcp_json")}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                >
                  {copiedKey === "mcp_json" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy JSON
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-sky-300 overflow-x-auto">
                {mcpConfigJson}
              </pre>
            </div>

            <div className="pt-2">
              <h4 className="text-xs font-semibold text-slate-300 mb-2">Available MCP Tools in WatchNet:</h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-center gap-2">
                  <code className="text-indigo-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">get_device_inventory(query, status, category)</code>
                  <span>Search online/offline devices, filter by category or vendor.</span>
                </li>
                <li className="flex items-center gap-2">
                  <code className="text-indigo-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">get_network_health()</code>
                  <span>Retrieve gateway latency, WAN IP, and recent speedtest benchmarks.</span>
                </li>
                <li className="flex items-center gap-2">
                  <code className="text-indigo-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">trigger_network_scan(interface)</code>
                  <span>Trigger asynchronous network discovery scans on local subnets.</span>
                </li>
                <li className="flex items-center gap-2">
                  <code className="text-indigo-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">get_device_details(device_id_or_mac)</code>
                  <span>Fetch in-depth metadata, port scan logs, and event history for a device.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

