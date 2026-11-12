"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  Lock,
  Unlock,
  Archive,
  RefreshCw,
  Smartphone,
  Laptop,
  Cpu,
  Network,
  Server,
  Tv,
  HelpCircle,
  Tag,
  FolderSync,
  ChevronRight,
  ExternalLink,
  ChevronLeft,
  ChevronDown,
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
    <Suspense fallback={<div className="p-6 text-slate-400">Loading devices...</div>}>
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
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let url = `/api/v1/devices?limit=1000&paginate=true&is_archived=${showArchived}`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      if (categoryFilter !== "all") url += `&category=${encodeURIComponent(categoryFilter)}`;
      if (siteFilter !== "all") url += `&site_id=${encodeURIComponent(siteFilter)}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await fetch(url, { credentials: "include", headers });
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch (e) {
      console.error("Failed to load device inventory", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/v1/sync/nodes", { headers });
      if (res.ok) {
        const data = await res.json();
        setSites(data);
      }
    } catch {
      // Sites load fallback
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
            className="text-slate-400 hover:text-white"
          >
            {table.getIsAllRowsSelected() ? (
              <CheckSquare className="w-4 h-4 text-cyan-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <button
            onClick={row.getToggleSelectedHandler()}
            className="text-slate-400 hover:text-white"
          >
            {row.getIsSelected() ? (
              <CheckSquare className="w-4 h-4 text-cyan-400" />
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
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isOnline ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                />
              </span>
              <span className={`text-xs font-medium uppercase tracking-wider ${isOnline ? "text-emerald-400" : "text-slate-400"}`}>
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
              <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700/60 text-cyan-400">
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <Link
                  href={`/devices/${row.original.id}`}
                  className="font-medium text-slate-200 hover:text-cyan-400 truncate flex items-center gap-1.5"
                >
                  {row.original.name || "(Unnamed Device)"}
                  {isLocked && (
                    <span title="Name locked against automated overwrite">
                      <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    </span>
                  )}
                </Link>
                <span className="text-xs text-slate-500 font-mono">{row.original.mac}</span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "ipv4",
        header: "IP Address",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-sm font-mono text-slate-300">
              {row.original.ipv4 || "—"}
            </span>
            {row.original.interface && (
              <span className="text-xs text-slate-500 font-mono">
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
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                {cat}
              </span>
              {isLocked && (
                <span title="Category locked">
                  <Lock className="w-3 h-3 text-amber-400" />
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
          <span className="text-sm text-slate-300 truncate max-w-[180px] block">
            {row.original.vendor || "Unknown Vendor"}
          </span>
        ),
      },
      {
        accessorKey: "last_seen",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 hover:text-white"
          >
            Last Seen
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.last_seen);
          return (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
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
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition"
            title="Inspect device telemetry & presence"
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
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Smartphone className="w-6 h-6 text-cyan-400" />
            Device Inventory & Historical Intelligence
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time multi-signal device registry with field locks, OUI manufacturer resolution, and presence analysis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDevices()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        {/* Search */}
        <div className="md:col-span-3 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search MAC, IP, vendor... (Enter)"
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        {/* Status filter */}
        <div className="md:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition"
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
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition"
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
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition"
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
        <div className="md:col-span-3 flex items-center justify-end">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
            />
            Show Archived Devices
          </label>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedDeviceIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-cyan-950/30 border border-cyan-800/60 rounded-xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-semibold">
              {selectedDeviceIds.length} Selected
            </span>
            <span className="text-xs text-slate-400">Batch operations:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Categorize */}
            <div className="flex items-center gap-1">
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
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
                className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium"
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
                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 w-24"
              />
              <button
                disabled={!bulkTag || bulkProcessing}
                onClick={() => handleBulkAction("tag")}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium border border-slate-700"
              >
                Tag
              </button>
            </div>

            {/* Archive / Unarchive */}
            {!showArchived ? (
              <button
                disabled={bulkProcessing}
                onClick={() => handleBulkAction("archive")}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-medium"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            ) : (
              <button
                disabled={bulkProcessing}
                onClick={() => handleBulkAction("unarchive")}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-300 text-xs font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Restore
              </button>
            )}
          </div>
        </div>
      )}

      {/* Devices TanStack Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 shadow-sm">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-medium">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                  Loading devices...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                  No devices found matching your criteria.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    row.getIsSelected() ? "bg-cyan-950/20" : ""
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
      <div className="flex items-center justify-between px-2 text-xs text-slate-400">
        <div>
          Showing {table.getRowModel().rows.length} of {devices.length} devices
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex items-center gap-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex items-center gap-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
