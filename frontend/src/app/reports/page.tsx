"use client";

import React, { useState, useEffect } from "react";
import { FileSpreadsheet, Download, Calendar, Inbox } from "lucide-react";

interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  generated_at: string;
  status: string;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState("inventory");
  const [downloading, setDownloading] = useState(false);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);

  const handleExport = async (format: "csv" | "json") => {
    setDownloading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/v1/devices?limit=1000&paginate=true", {
        credentials: "include",
        headers,
      });

      let devices: Array<{ id: string; name: string | null; ipv4: string | null; mac: string; vendor: string | null; status: string }> = [];
      if (res.ok) {
        const data = await res.json();
        devices = Array.isArray(data) ? data : data.devices || [];
      }

      let content = "";
      if (format === "csv") {
        const rows = ["id,name,ip,mac,vendor,status"];
        devices.forEach((d) => {
          rows.push(`"${d.id}","${d.name || ""}","${d.ipv4 || ""}","${d.mac || ""}","${d.vendor || ""}","${d.status || ""}"`);
        });
        content = rows.join("\n");
      } else {
        content = JSON.stringify(devices, null, 2);
      }

      const blob = new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8;" : "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watchnet-report-${reportType}-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export generation failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-accent" />
            Compliance & Network Reports
          </h1>
          <p className="text-sm text-muted">Generate, schedule, and export network audits and inventory datasets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-text">Generate Custom Audit</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Report Dataset</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full mt-1 bg-background border border-border rounded-lg p-2 text-sm text-text focus:outline-none focus:border-accent"
              >
                <option value="inventory">Hardware & Device Inventory</option>
                <option value="security">Security Vulnerability Assessment</option>
                <option value="dhcp">DHCP Allocation & IP History</option>
                <option value="parental">DNS & Family Safety Audit</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted uppercase font-semibold">Timeframe</label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-muted" />
                <span className="text-sm text-text">Last 30 Days (Rolling)</span>
              </div>
            </div>
            <div className="pt-2 flex gap-3">
              <button
                onClick={() => handleExport("csv")}
                disabled={downloading}
                className="flex-1 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                <Download className="w-4 h-4" /> {downloading ? "Exporting..." : "Export CSV"}
              </button>
              <button
                onClick={() => handleExport("json")}
                disabled={downloading}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-border rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-surface border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-text mb-4">Scheduled Audit History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text">
              <thead className="bg-background text-muted uppercase text-xs">
                <tr>
                  <th className="py-2.5 px-3">Report Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Generated</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {scheduledReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted text-xs">
                      <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted" />
                      No scheduled audit reports generated yet. Scheduled compliance scans will archive copies here automatically.
                    </td>
                  </tr>
                ) : (
                  scheduledReports.map((rpt) => (
                    <tr key={rpt.id}>
                      <td className="py-2.5 px-3 font-medium text-text">{rpt.name}</td>
                      <td className="py-2.5 px-3">{rpt.type}</td>
                      <td className="py-2.5 px-3 text-muted">{rpt.generated_at}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs bg-status-online/10 text-status-online px-2 py-0.5 rounded">
                          {rpt.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button onClick={() => handleExport("csv")} className="text-xs text-accent hover:underline">
                          Download
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
