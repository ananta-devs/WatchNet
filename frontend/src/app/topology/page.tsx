"use client";

import React, { useState, useEffect } from "react";
import {
  Network,
  RefreshCw,
  Server,
  Laptop,
  Smartphone,
  Layers,
  Search,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2
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
  const [zoomLevel, setZoomLevel] = useState(1);

  const fetchTopology = async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
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
        const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/v1/monitoring/devices/${rawId}/ports`, { headers, credentials: "include" });
        if (res.ok) {
          const portsData = await res.json();
          setPorts(portsData);
        }
      } catch (e) {
        console.error("Failed fetching node ports", e);
      }
    }
  };

  const triggerPortScan = async () => {
    if (!selectedNode || !selectedNode.id.startsWith("dev-")) return;
    const rawId = selectedNode.id.replace("dev-", "");
    try {
      setScanningPorts(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/monitoring/devices/${rawId}/ports/scan`, {
        method: "POST",
        headers,
        credentials: "include"
      });
      if (res.ok) {
        const scanRes = await res.json();
        setPorts(scanRes.open_ports || []);
      }
    } catch (e) {
      console.error("Failed to trigger port scan", e);
    } finally {
      setScanningPorts(false);
    }
  };

  // Filter nodes if search query present
  const filteredNodes = (data?.nodes || []).filter((n) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      n.label.toLowerCase().includes(term) ||
      (n.ip && n.ip.toLowerCase().includes(term)) ||
      (n.mac && n.mac.toLowerCase().includes(term))
    );
  });

  // Group nodes by hierarchy levels (0: Internet, 1: Gateway, 2: Switch/AP, 3: Clients)
  const nodesByLevel: Record<number, TopologyNode[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
  };

  filteredNodes.forEach((node) => {
    const lvl = node.level ?? 3;
    if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
    nodesByLevel[lvl].push(node);
  });

  const zoomIn = () => setZoomLevel((z) => Math.min(z + 0.15, 1.5));
  const zoomOut = () => setZoomLevel((z) => Math.max(z - 0.15, 0.7));
  const resetZoom = () => setZoomLevel(1);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 border-b border-border pb-3 sm:pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text flex items-center gap-2 sm:gap-2.5">
            <Network className="w-5 h-5 sm:w-6 sm:h-6 text-accent shrink-0" />
            <span>Interactive Network Topology</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Dynamic hierarchical L2/L3 topology visualization: Gateway &rarr; Switches/APs &rarr; Clients
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search nodes, IP, MAC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-text placeholder-muted focus:outline-none focus:border-accent w-full sm:w-56 shadow-xs min-h-[38px] sm:min-h-[32px]"
            />
          </div>
          <button
            onClick={fetchTopology}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-surface hover:bg-hover text-text border border-border transition cursor-pointer min-h-[38px] sm:min-h-[32px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Map
          </button>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-surface border border-border rounded-xl p-3 sm:p-4 shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-muted">Total Nodes</span>
          <div className="text-xl sm:text-2xl font-bold text-text mt-1">{data?.summary.total_nodes ?? 0}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3 sm:p-4 shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-muted">Total Links</span>
          <div className="text-xl sm:text-2xl font-bold text-text mt-1">{data?.summary.total_edges ?? 0}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3 sm:p-4 shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-muted">Infrastructure</span>
          <div className="text-xl sm:text-2xl font-bold text-accent mt-1">{data?.summary.infra_count ?? 1}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-3 sm:p-4 shadow-xs">
          <span className="text-[10px] sm:text-xs font-semibold uppercase text-muted">Client Devices</span>
          <div className="text-xl sm:text-2xl font-bold text-status-online mt-1">{data?.summary.devices_count ?? 0}</div>
        </div>
      </div>

      {/* Main Interactive Diagram & Inspection Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Topology Diagram Grid Canvas */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-4 sm:p-6 relative min-h-[480px] overflow-hidden shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-border/80">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-accent" />
              Hierarchy View
            </span>
            <div className="flex items-center justify-between w-full sm:w-auto gap-3">
              <div className="flex gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-accent" /> Gateway
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-status-online" /> Client
                </span>
              </div>
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5">
                <button
                  onClick={zoomOut}
                  className="p-1 text-muted hover:text-text rounded hover:bg-hover cursor-pointer"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={resetZoom}
                  className="px-1.5 text-[10px] font-mono text-muted hover:text-text cursor-pointer"
                  title="Reset Zoom"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  onClick={zoomIn}
                  className="p-1 text-muted hover:text-text rounded hover:bg-hover cursor-pointer"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Zoomable Canvas Container with touch scrolling */}
          <div className="flex-1 overflow-auto p-2">
            <div
              className="flex flex-col items-center gap-6 py-2 transition-transform duration-150 origin-top min-w-[320px]"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              {/* Level 0: WAN Cloud */}
              <div className="flex justify-center w-full">
                {nodesByLevel[0]?.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => selectNode(node)}
                    className={`cursor-pointer px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border transition flex items-center gap-3 shadow-xs ${
                      selectedNode?.id === node.id
                        ? "bg-accent/15 border-accent ring-2 ring-accent/30"
                        : "bg-background border-border hover:bg-hover"
                    }`}
                  >
                    <Server className="w-5 h-5 sm:w-6 sm:h-6 text-accent shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-text">{node.label}</div>
                      <div className="text-[10px] text-muted font-mono">{node.ip}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="w-0.5 h-5 bg-border" />

              {/* Level 1: Gateway */}
              <div className="flex justify-center w-full">
                {nodesByLevel[1]?.map((node) => (
                  <div
                    key={node.id}
                    onClick={() => selectNode(node)}
                    className={`cursor-pointer px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border transition flex items-center gap-3 shadow-xs ${
                      selectedNode?.id === node.id
                        ? "bg-accent/15 border-accent ring-2 ring-accent/30"
                        : "bg-background border-border hover:bg-hover"
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-status-online shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-text">{node.label}</div>
                      <div className="text-[10px] text-muted font-mono">{node.ip || "192.168.1.1"}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="w-0.5 h-5 bg-border" />

              {/* Level 3: Connected Clients & Peripherals */}
              <div className="w-full">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 text-center">
                  Connected Clients & Peripherals ({nodesByLevel[3]?.length || 0})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {nodesByLevel[3]?.map((node) => (
                    <div
                      key={node.id}
                      onClick={() => selectNode(node)}
                      className={`cursor-pointer p-2.5 sm:p-3 rounded-lg border transition flex flex-col justify-between ${
                        selectedNode?.id === node.id
                          ? "bg-accent/15 border-accent ring-2 ring-accent/30"
                          : "bg-background border-border hover:bg-hover"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        {node.category?.toLowerCase().includes("mobile") ? (
                          <Smartphone className="w-4 h-4 text-status-online" />
                        ) : (
                          <Laptop className="w-4 h-4 text-muted" />
                        )}
                        <span
                          className={`w-2 h-2 rounded-full ${
                            node.status === "online" ? "bg-status-online" : "bg-muted"
                          }`}
                        />
                      </div>
                      <div className="text-xs font-semibold text-text truncate">{node.label}</div>
                      <div className="text-[10px] text-muted font-mono truncate">{node.ip || "No IP"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Node Details & Port Scanning Drawer */}
        <div className="bg-surface border border-border rounded-xl p-4 sm:p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-text flex items-center gap-2">
                <Info className="w-4 h-4 text-accent" />
                Node Inspector
              </h2>
              {selectedNode && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-hover text-text uppercase font-mono border border-border">
                  {selectedNode.type}
                </span>
              )}
            </div>

            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] text-muted uppercase tracking-wider">Device / Node Name</div>
                  <div className="text-base sm:text-lg font-bold text-text break-all">{selectedNode.label}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-background p-2.5 rounded-lg border border-border">
                    <span className="text-muted block text-[10px] uppercase">IP Address</span>
                    <span className="font-mono text-text">{selectedNode.ip || "N/A"}</span>
                  </div>
                  <div className="bg-background p-2.5 rounded-lg border border-border">
                    <span className="text-muted block text-[10px] uppercase">MAC Address</span>
                    <span className="font-mono text-text truncate block">{selectedNode.mac || "N/A"}</span>
                  </div>
                </div>

                <div className="text-xs bg-background p-3 rounded-lg border border-border space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted">Category:</span>
                    <span className="text-text font-medium">{selectedNode.category || "General"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Vendor:</span>
                    <span className="text-text font-medium truncate ml-2">{selectedNode.vendor || "Generic Device"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Hierarchy Level:</span>
                    <span className="text-text font-medium">Level {selectedNode.level}</span>
                  </div>
                </div>

                {/* Port Scan Findings */}
                {selectedNode.id.startsWith("dev-") && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase text-muted">
                        Open TCP Ports ({ports.length})
                      </span>
                      <button
                        onClick={triggerPortScan}
                        disabled={scanningPorts}
                        className="px-2.5 py-1 text-xs rounded bg-accent hover:bg-accent-hover text-white font-medium transition disabled:opacity-50 shadow-xs cursor-pointer min-h-[32px]"
                      >
                        {scanningPorts ? "Scanning..." : "Scan Ports"}
                      </button>
                    </div>

                    {ports.length === 0 ? (
                      <div className="text-xs text-muted bg-background/60 p-3 rounded-lg border border-dashed border-border text-center">
                        No open ports detected. Click &quot;Scan Ports&quot; to probe common TCP services.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {ports.map((p, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-background p-2 rounded border border-border"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-status-online/10 text-status-online font-mono text-[11px] font-semibold border border-status-online/20">
                                {p.port}/{p.protocol}
                              </span>
                              <span className="text-text font-medium">{p.service_name}</span>
                            </div>
                            <span className="text-[10px] text-muted truncate max-w-[120px]">
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
              <div className="h-48 sm:h-64 flex flex-col items-center justify-center text-xs sm:text-sm text-muted text-center px-4">
                <Network className="w-8 h-8 sm:w-10 sm:h-10 text-muted mb-2" />
                Select any node from the diagram to inspect IP, MAC, hardware vendor, and scan TCP ports.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
