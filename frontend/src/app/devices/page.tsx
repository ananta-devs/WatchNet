"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import {
  Search,
  CheckSquare,
  Square,
  Lock,
  Archive,
  RefreshCw,
  Smartphone,
  Laptop,
  Cpu,
  Network,
  Server,
  Tv,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Clock,
  ArrowUpDown
} from "lucide-react";

export interface DeviceRecord {
  id: string;
  mac: string;
  ipv4: string | null;
  ipv6: string | null;
  vendor: string | null;
  name: string | null;
  interface: string | null;
  status: "online" | "offline" | "unknown";
  category: "Mobile" | "Desktop/Laptop" | "IoT/Smart Home" | "Network/Infrastructure" | "Server" | "Gaming/Media" | "Unknown";
  icon: string | null;
  notes: string | null;
  is_archived: boolean;
  locked_fields: string[];
  first_seen: string;
  last_seen: string;
  custom_properties: Record<string, any>;
  site_id?: string | null;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Mobile": Smartphone,
  "Desktop/Laptop": Laptop,
  "IoT/Smart Home": Cpu,
  "Network/Infrastructure": Network,
  "Server": Server,
  "Gaming/Media": Tv,
  "Unknown": HelpCircle,
};

export default function DeviceInventoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted">Loading devices...</div>}>
      <DeviceInventoryContent />
    </Suspense>
  );
}

function DeviceInventoryContent() {
  const searchParams = useSearchParams();
  const initialSiteParam = searchParams.get("site_id") || "all";

  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>(initialSiteParam);
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "last_seen", desc: true }]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Bulk action states
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [bulkTag, setBulkTag] = useState<string>("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let url = "/api/v1/devices?limit=100&paginate=true";
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      if (categoryFilter !== "all") url += `&category=${encodeURIComponent(categoryFilter)}`;
      if (siteFilter !== "all") url += `&site_id=${siteFilter}`;
      if (showArchived) url += `&include_archived=true`;
      if (search) url += `&query=${encodeURIComponent(search)}`;

      const res = await fetch(url, { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const devList = Array.isArray(data) ? data : data.devices || [];
        setDevices(devList);
      }
    } catch (e) {
      console.error("Failed to fetch devices", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/sync/nodes", { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSites(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch sites", e);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [statusFilter, categoryFilter, siteFilter, showArchived]);

  // Handle Enter on search input
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      fetchDevices();
    }
  };

  // Bulk actions
  const selectedDeviceIds = useMemo(() => {
    return Object.keys(rowSelection).filter((id) => rowSelection[id]);
  }, [rowSelection]);

  const handleBulkAction = async (action: "categorize" | "tag" | "archive" | "unarchive") => {
    if (selectedDeviceIds.length === 0) return;
    setBulkProcessing(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const payload: Record<string, any> = {
        device_ids: selectedDeviceIds
      };

      if (action === "categorize" && bulkCategory) {
        payload.category = bulkCategory;
        payload.lock_category = true;
      } else if (action === "tag" && bulkTag) {
        payload.add_tags = [bulkTag];
      } else if (action === "archive") {
        payload.is_archived = true;
      } else if (action === "unarchive") {
        payload.is_archived = false;
      }

      const res = await fetch("/api/v1/devices/bulk", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setRowSelection({});
        setBulkCategory("");
        setBulkTag("");
        await fetchDevices();
      }
    } catch (e) {
      console.error("Bulk action failed", e);
    } finally {
      setBulkProcessing(false);
    }
  };

  const columns = useMemo<ColumnDef<DeviceRecord>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <button
            onClick={table.getToggleAllRowsSelectedHandler()}
            className="text-muted hover:text-text cursor-pointer p-1"
            aria-label="Select all"
          >
            {table.getIsAllRowsSelected() ? (
              <CheckSquare className="w-4 h-4 text-accent" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <button
            onClick={row.getToggleSelectedHandler()}
            className="text-muted hover:text-text cursor-pointer p-1"
            aria-label="Select row"
          >
            {row.getIsSelected() ? (
              <CheckSquare className="w-4 h-4 text-accent" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const isOnline = row.original.status === "online";
          return (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-online opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isOnline ? "bg-status-online" : "bg-muted"
                  }`}
                />
              </span>
              <span className={`text-xs font-medium uppercase tracking-wider ${isOnline ? "text-status-online" : "text-muted"}`}>
                {row.original.status}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "name",
        header: "Device Name / Host",
        cell: ({ row }) => {
          const IconComponent = CATEGORY_ICONS[row.original.category] || HelpCircle;
          const isLocked = (row.original.locked_fields || []).includes("name");
          return (
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-hover border border-border text-accent shrink-0">
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <Link
                  href={`/devices/${row.original.id}`}
                  className="font-medium text-text hover:text-accent truncate flex items-center gap-1.5"
                >
                  <span className="truncate">{row.original.name || "(Unnamed Device)"}</span>
                  {isLocked && (
                    <span title="Name locked against automated overwrite">
                      <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                    </span>
                  )}
                </Link>
                <span className="text-xs text-muted font-mono truncate">{row.original.mac}</span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "ipv4",
        header: "IP Address",
        cell: ({ row }) => (
          <div className="flex flex-col font-mono text-xs">
            <span className="text-text">
              {row.original.ipv4 || "—"}
            </span>
            {row.original.interface && (
              <span className="text-[11px] text-muted">
                {row.original.interface}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => {
          const cat = row.original.category;
          const isLocked = (row.original.locked_fields || []).includes("category");
          return (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 text-xs rounded-full bg-hover border border-border text-text whitespace-nowrap">
                {cat}
              </span>
              {isLocked && (
                <span title="Category locked">
                  <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "vendor",
        header: "Vendor / Manufacturer",
        cell: ({ row }) => (
          <span className="text-sm text-text truncate max-w-[180px] block">
            {row.original.vendor || "Unknown Vendor"}
          </span>
        ),
      },
      {
        accessorKey: "last_seen",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 hover:text-text cursor-pointer"
          >
            Last Seen
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.last_seen);
          return (
            <div className="flex items-center gap-1.5 text-xs text-muted whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-muted shrink-0" />
              <span>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/devices/${row.original.id}`}
            className="p-1.5 rounded hover:bg-hover text-muted hover:text-accent transition flex items-center justify-center min-w-[32px] min-h-[32px]"
            title="Inspect device telemetry & presence"
            aria-label="Inspect device details"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: devices,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text tracking-tight flex items-center gap-2 sm:gap-2.5">
            <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-accent shrink-0" />
            <span>Device Inventory & Historical Intelligence</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Real-time multi-signal device registry with field locks, OUI manufacturer resolution, and presence analysis.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchDevices()}
            disabled={loading}
            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg bg-surface hover:bg-hover text-text border border-border shadow-xs text-xs sm:text-sm font-medium transition cursor-pointer min-h-[40px] sm:min-h-[36px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-accent" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 sm:gap-3 bg-surface p-3 sm:p-4 rounded-xl border border-border shadow-xs">
        {/* Search */}
        <div className="sm:col-span-2 md:col-span-3 relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-2.5 sm:top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search MAC, IP, vendor... (Enter)"
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition min-h-[38px]"
          />
        </div>

        {/* Status filter */}
        <div className="md:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:border-accent transition min-h-[38px]"
          >
            <option value="all">All Statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        {/* Category filter */}
        <div className="md:col-span-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:border-accent transition min-h-[38px]"
          >
            <option value="all">All Categories</option>
            <option value="Mobile">Mobile</option>
            <option value="Desktop/Laptop">Desktop / Laptop</option>
            <option value="IoT/Smart Home">IoT / Smart Home</option>
            <option value="Network/Infrastructure">Network / Infrastructure</option>
            <option value="Server">Server</option>
            <option value="Gaming/Media">Gaming / Media</option>
            <option value="Unknown">Unknown</option>
          </select>
        </div>

        {/* Site filter */}
        <div className="md:col-span-2">
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-text focus:outline-none focus:border-accent transition min-h-[38px]"
          >
            <option value="all">All Sites / Hubs</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Archival toggle */}
        <div className="sm:col-span-2 md:col-span-3 flex items-center justify-start md:justify-end">
          <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm text-text py-1">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded bg-background border-border text-accent focus:ring-0"
            />
            <span>Show Archived Devices</span>
          </label>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedDeviceIds.length > 0 && (
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3 p-3 bg-accent/10 border border-accent/30 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-accent/20 text-accent text-xs font-semibold">
              {selectedDeviceIds.length} Selected
            </span>
            <span className="text-xs text-muted">Batch operations:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Categorize */}
            <div className="flex items-center gap-1">
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="px-2 py-1 bg-surface border border-border rounded text-xs text-text"
              >
                <option value="">Category...</option>
                <option value="Mobile">Mobile</option>
                <option value="Desktop/Laptop">Desktop/Laptop</option>
                <option value="IoT/Smart Home">IoT/Smart Home</option>
                <option value="Network/Infrastructure">Network/Infrastructure</option>
                <option value="Server">Server</option>
                <option value="Gaming/Media">Gaming/Media</option>
              </select>
              <button
                disabled={!bulkCategory || bulkProcessing}
                onClick={() => handleBulkAction("categorize")}
                className="px-2.5 py-1 rounded bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
              >
                Apply
              </button>
            </div>

            {/* Tag */}
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Add tag..."
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
                className="px-2 py-1 bg-surface border border-border rounded text-xs text-text w-24"
              />
              <button
                disabled={!bulkTag || bulkProcessing}
                onClick={() => handleBulkAction("tag")}
                className="px-2.5 py-1 rounded bg-hover hover:bg-border disabled:opacity-50 text-text text-xs font-medium border border-border cursor-pointer"
              >
                Tag
              </button>
            </div>

            {/* Archive / Unarchive */}
            {!showArchived ? (
              <button
                disabled={bulkProcessing}
                onClick={() => handleBulkAction("archive")}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-status-critical/10 hover:bg-status-critical/20 border border-status-critical/30 text-status-critical text-xs font-medium cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            ) : (
              <button
                disabled={bulkProcessing}
                onClick={() => handleBulkAction("unarchive")}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-status-online/10 hover:bg-status-online/20 border border-status-online/30 text-status-online text-xs font-medium cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Restore
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Card List View (Visible on small screens < md) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted bg-surface rounded-xl border border-border">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-accent" />
            Loading devices...
          </div>
        ) : devices.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted bg-surface rounded-xl border border-border">
            No devices found matching your criteria.
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const dev = row.original;
            const IconComponent = CATEGORY_ICONS[dev.category] || HelpCircle;
            const isOnline = dev.status === "online";
            const isLocked = (dev.locked_fields || []).includes("name");
            const isSelected = row.getIsSelected();

            return (
              <div
                key={dev.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSelected ? "bg-accent/10 border-accent/40" : "bg-surface border-border shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={row.getToggleSelectedHandler()}
                      className="text-muted hover:text-text cursor-pointer p-0.5"
                      aria-label="Select row"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="p-1.5 rounded-lg bg-hover border border-border text-accent shrink-0">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/devices/${dev.id}`}
                        className="font-semibold text-sm text-text hover:text-accent truncate flex items-center gap-1.5"
                      >
                        <span className="truncate">{dev.name || "(Unnamed Device)"}</span>
                        {isLocked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                      </Link>
                      <span className="text-[11px] text-muted font-mono truncate block">{dev.mac}</span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 uppercase tracking-wider ${
                      isOnline
                        ? "bg-status-online/10 text-status-online border border-status-online/20"
                        : "bg-muted/10 text-muted border border-border"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-status-online" : "bg-muted"}`} />
                    {dev.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-border/80 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-muted uppercase tracking-wider block font-sans">IP Address</span>
                    <span className="text-text font-medium">{dev.ipv4 || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase tracking-wider block font-sans">Vendor</span>
                    <span className="text-text truncate block font-sans">{dev.vendor || "Unknown"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/60 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-hover border border-border text-[10px] text-text font-medium">
                      {dev.category}
                    </span>
                  </div>
                  <Link
                    href={`/devices/${dev.id}`}
                    className="text-accent hover:underline text-xs font-medium flex items-center gap-1 min-h-[36px]"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop TanStack Table (Hidden on small mobile screens) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-surface shadow-xs">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-hover/50 text-muted font-medium">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-accent" />
                  Loading devices...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted">
                  No devices found matching your criteria.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-hover transition-colors ${
                    row.getIsSelected() ? "bg-accent/10" : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-xs text-muted">
        <div>
          Showing {table.getRowModel().rows.length} of {devices.length} devices
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface hover:bg-hover disabled:opacity-50 text-text border border-border cursor-pointer min-h-[36px]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          <span className="px-1 font-medium">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface hover:bg-hover disabled:opacity-50 text-text border border-border cursor-pointer min-h-[36px]"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
