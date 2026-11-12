"use client";

import React, { useState } from "react";
import { FileSpreadsheet, Download, Filter, Calendar } from "lucide-react";

export default function ReportsPage() {
  const [reportType, setReportType] = useState("inventory");
  const [downloading, setDownloading] = useState(false);

  const handleExport = (format: "csv" | "json") => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      const content = "id,name,ip,mac,vendor,status\n1,Gateway-Router,192.168.1.1,00:11:22:33:44:55,Ubiquiti,online\n2,Primary-DNS,192.168.1.2,00:11:22:33:44:66,Pi-hole,online";
      const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watchnet-report-${reportType}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
            Compliance & Network Reports
          </h1>
          <p className="text-sm text-slate-400">Generate, schedule, and export network audits and inventory datasets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">Generate Custom Audit</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 uppercase font-semibold">Report Dataset</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="inventory">Hardware & Device Inventory</option>
                <option value="security">Security Vulnerability Assessment</option>
                <option value="dhcp">DHCP Allocation & IP History</option>
                <option value="parental">DNS & Family Safety Audit</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase font-semibold">Timeframe</label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-300">Last 30 Days (Rolling)</span>
              </div>
            </div>
            <div className="pt-2 flex gap-3">
              <button
                onClick={() => handleExport("csv")}
                disabled={downloading}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button
                onClick={() => handleExport("json")}
                disabled={downloading}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Scheduled Audit History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="py-2.5 px-3">Report Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Generated</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr>
                  <td className="py-2.5 px-3 font-medium text-white">Monthly Network Inventory</td>
                  <td className="py-2.5 px-3">Hardware Inventory</td>
                  <td className="py-2.5 px-3 text-slate-400">2026-11-01 00:00</td>
                  <td className="py-2.5 px-3"><span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">Ready</span></td>
                  <td className="py-2.5 px-3 text-right">
                    <button onClick={() => handleExport("csv")} className="text-xs text-indigo-400 hover:underline">Download</button>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-white">DNS Policy Enforcement Log</td>
                  <td className="py-2.5 px-3">Parental Controls</td>
                  <td className="py-2.5 px-3 text-slate-400">2026-11-10 12:00</td>
                  <td className="py-2.5 px-3"><span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">Ready</span></td>
                  <td className="py-2.5 px-3 text-right">
                    <button onClick={() => handleExport("csv")} className="text-xs text-indigo-400 hover:underline">Download</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
