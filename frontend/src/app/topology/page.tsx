"use client";

import React, { useState, useEffect } from "react";
import {
  Network,
  RefreshCw,
  Server,
  Router as RouterIcon,
  Laptop,
  Smartphone,
  Shield,
  Layers,
  Search,
  ExternalLink,
  Info
} from "lucide-react";

interface TopologyNode {
  id: string;
  label: string;
  type: string;
  category?: string;
  status?: string;
  ip?: string;
  mac?: string;
  vendor?: string;
  level: number;
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
}

interface TopologyData {
  summary: {
    total_nodes: number;
    total_edges: number;
    devices_count: number;
    infra_count: number;
  };
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

interface PortScanItem {
  port: number;
  protocol: string;
  service_name?: string;
  state: string;
  banner?: string;
}

export default function TopologyPage() {
  const [data, setData] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [ports, setPorts] = useState<PortScanItem[]>([]);
  const [scanningPorts, setScanningPorts] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchTopology = async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/topology", { headers, credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load topology", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopology();
  }, []);

  const selectNode = async (node: TopologyNode) => {
    setSelectedNode(node);
    setPorts([]);
    // If device node with ID, fetch ports
    if (node.id.startsWith("dev-")) {
      const rawId = node.id.replace("dev-", "");
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/v1/monitoring/devices/${rawId}/ports`, { headers, credentials: "include" });
        if (res.ok) {
          const body = await res.json();
          setPorts(body.ports || []);
        }
      } catch (e) {
        console.error("Could not fetch device ports", e);
      }
    }
  };

  const triggerPortScan = async () => {
    if (!selectedNode || !selectedNode.id.startsWith("dev-")) return;
    const rawId = selectedNode.id.replace("dev-", "");
    setScanningPorts(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/monitoring/devices/${rawId}/scan-ports`, {
        method: "POST",
        headers,
        credentials: "include"
      });
      if (res.ok) {
        const body = await res.json();
        setPorts(body.ports || []);
      }
    } catch (e) {
      console.error("Port scan failed", e);
    } finally {
      setScanningPorts(false);
    }
  };

  const filteredNodes = (data?.nodes || []).filter((n) =>
    n.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.ip && n.ip.includes(searchTerm)) ||
    (n.mac && n.mac.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group nodes by level: 0 = WAN, 1 = Gateway, 2 = Infrastructure, 3 = Clients
  const nodesByLevel: Record<number, TopologyNode[]> = { 0: [], 1: [], 2: [], 3: [] };
  filteredNodes.forEach((n) => {
    const lvl = n.level in nodesByLevel ? n.level : 3;
    nodesByLevel[lvl].push(n);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Network className="w-6 h-6 text-indigo-400" />
            Interactive Network Topology
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dynamic hierarchical L2/L3 topology visualization: Gateway &rarr; Switches/APs &rarr; Clients
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search nodes, IP, MAC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-56"
            />
          </div>
          <button
            onClick={fetchTopology}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Map
          </button>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold uppercase text-slate-400">Total Nodes</span>
          <div className="text-2xl font-bold text-slate-100 mt-1">{data?.summary.total_nodes ?? 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold uppercase text-slate-400">Total Links (Edges)</span>
          <div className="text-2xl font-bold text-slate-100 mt-1">{data?.summary.total_edges ?? 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold uppercase text-slate-400">Infrastructure Nodes</span>
          <div className="text-2xl font-bold text-indigo-400 mt-1">{data?.summary.infra_count ?? 1}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold uppercase text-slate-400">Client Devices</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{data?.summary.devices_count ?? 0}</div>
        </div>
      </div>

      {/* Main Interactive Diagram & Inspection Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topology Diagram Grid Canvas */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 relative min-h-[500px] overflow-x-auto">
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-400" />
              Hierarchy View
            </span>
            <div className="flex gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Gateway/WAN
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Switch / AP
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Client
              </span>
            </div>
          </div>

          {/* Level 0: WAN Cloud */}
          <div className="flex flex-col items-center gap-8 py-2">
            <div className="flex justify-center w-full">
              {nodesByLevel[0]?.map((node) => (
                <div
                  key={node.id}
                  onClick={() => selectNode(node)}
                  className={`cursor-pointer px-5 py-3 rounded-xl border transition flex items-center gap-3 shadow-lg ${
                    selectedNode?.id === node.id
                      ? "bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/30"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <Server className="w-6 h-6 text-indigo-400" />
                  <div>
                    <div className="text-xs font-bold text-slate-200">{node.label}</div>
                    <div className="text-[10px] text-slate-500">{node.ip}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="w-0.5 h-6 bg-slate-800" />

            {/* Level 1: Gateway */}
            <div className="flex justify-center w-full">
              {nodesByLevel[1]?.map((node) => (
                <div
                  key={node.id}
                  onClick={() => selectNode(node)}
                  className={`cursor-pointer px-6 py-4 rounded-xl border transition flex items-center gap-3 shadow-lg ${
                    selectedNode?.id === node.id
                      ? "bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/30"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <RouterIcon className="w-6 h-6 text-emerald-400" />
                  <div>
                    <div className="text-sm font-bold text-slate-100">{node.label}</div>
                    <div className="text-xs text-slate-400 font-mono">{node.ip}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{node.mac}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Level 2: Infrastructure Switches / APs (if any) */}
            {nodesByLevel[2]?.length > 0 && (
              <>
                <div className="w-0.5 h-6 bg-slate-800" />
                <div className="flex flex-wrap justify-center gap-4 w-full">
                  {nodesByLevel[2].map((node) => (
                    <div
                      key={node.id}
                      onClick={() => selectNode(node)}
                      className={`cursor-pointer px-4 py-3 rounded-lg border transition flex items-center gap-2.5 ${
                        selectedNode?.id === node.id
                          ? "bg-indigo-950/80 border-indigo-500"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <Layers className="w-5 h-5 text-cyan-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{node.label}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{node.ip}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="w-0.5 h-6 bg-slate-800" />

            {/* Level 3: Client Devices */}
            <div className="w-full">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 text-center">
                Connected Clients & Peripherals ({nodesByLevel[3]?.length || 0})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {nodesByLevel[3]?.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => selectNode(node)}
                    className={`cursor-pointer p-3 rounded-lg border transition flex flex-col justify-between ${
                      selectedNode?.id === node.id
                        ? "bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/20"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      {node.category?.toLowerCase().includes("mobile") ? (
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Laptop className="w-4 h-4 text-slate-400" />
                      )}
                      <span
                        className={`w-2 h-2 rounded-full ${
                          node.status === "online" ? "bg-emerald-500" : "bg-slate-600"
                        }`}
                      />
                    </div>
                    <div className="text-xs font-semibold text-slate-200 truncate">{node.label}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">{node.ip || "No IP"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Node Details & Port Scanning Drawer */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                Node Inspector
              </h2>
              {selectedNode && (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                  {selectedNode.type}
                </span>
              )}
            </div>

            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500">Device / Node Name</div>
                  <div className="text-lg font-bold text-slate-100">{selectedNode.label}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">IP Address</span>
                    <span className="font-mono text-slate-200">{selectedNode.ip || "N/A"}</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">MAC Address</span>
                    <span className="font-mono text-slate-200 truncate block">{selectedNode.mac || "N/A"}</span>
                  </div>
                </div>

                <div className="text-xs bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Category:</span>
                    <span className="text-slate-300">{selectedNode.category || "General"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vendor:</span>
                    <span className="text-slate-300">{selectedNode.vendor || "Generic Device"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hierarchy Level:</span>
                    <span className="text-slate-300">Level {selectedNode.level}</span>
                  </div>
                </div>

                {/* Port Scan Findings */}
                {selectedNode.id.startsWith("dev-") && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase text-slate-400">
                        Open TCP Ports ({ports.length})
                      </span>
                      <button
                        onClick={triggerPortScan}
                        disabled={scanningPorts}
                        className="px-2.5 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition disabled:opacity-50"
                      >
                        {scanningPorts ? "Scanning..." : "Scan Ports"}
                      </button>
                    </div>

                    {ports.length === 0 ? (
                      <div className="text-xs text-slate-500 bg-slate-950/60 p-3 rounded-lg border border-dashed border-slate-800 text-center">
                        No open ports detected. Click &quot;Scan Ports&quot; to probe common TCP services.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {ports.map((p, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-slate-950 p-2 rounded border border-slate-800/80"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px] font-semibold border border-emerald-500/20">
                                {p.port}/{p.protocol}
                              </span>
                              <span className="text-slate-300 font-medium">{p.service_name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                              {p.banner || "Open"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-sm text-slate-500 text-center px-4">
                <Network className="w-10 h-10 text-slate-700 mb-2" />
                Select any node from the diagram to inspect IP, MAC, hardware vendor, and scan TCP ports.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
