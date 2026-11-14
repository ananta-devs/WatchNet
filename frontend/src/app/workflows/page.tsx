"use client";

import React, { useState, useEffect } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  GitBranch,
  Play,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  RefreshCw,
  Sliders,
  Send,
  Zap,
  Tag,
  Shield,
  Layers
} from "lucide-react";

interface WorkflowRule {
  id: string;
  name: string;
  is_enabled: boolean;
  trigger_event: string;
  conditions_json: any[];
  actions_json: any[];
  execution_count: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkflowLog {
  id: number;
  rule_id: string;
  trigger_event: string;
  matched: boolean;
  actions_executed: any[];
  error_message: string | null;
  executed_at: string;
}

const TRIGGER_EVENTS = [
  { id: "NEW_DEVICE_DETECTED", label: "New Device Detected" },
  { id: "DEVICE_CONNECTED", label: "Device Connected" },
  { id: "DEVICE_DISCONNECTED", label: "Device Disconnected" },
  { id: "IP_CHANGED", label: "IP Address Changed" },
  { id: "GATEWAY_OFFLINE", label: "Gateway / Router Offline" },
  { id: "WEBSITE_DOWN", label: "Monitored Website Down" },
  { id: "HIGH_LATENCY", label: "High Latency Detected" },
];

const CONDITION_TYPES = [
  { id: "vendor_equals", label: "Vendor Equals", defaultVal: "Apple" },
  { id: "vendor_contains", label: "Vendor Contains", defaultVal: "Raspberry" },
  { id: "category_equals", label: "Category Equals", defaultVal: "IoT/Smart Home" },
  { id: "ip_in_cidr", label: "IP In CIDR Subnet", defaultVal: "192.168.1.0/24" },
  { id: "mac_matches", label: "MAC Pattern Matches", defaultVal: "B8:27:EB:*" },
  { id: "is_randomized_mac", label: "Is Randomized MAC", defaultVal: "true" },
  { id: "time_between", label: "Time Between (Schedule)", defaultVal: "22:00-06:00" },
];

const ACTION_TYPES = [
  { id: "send_notification", label: "Send Notification Alert" },
  { id: "assign_category", label: "Assign Device Category" },
  { id: "add_tag", label: "Add Custom Tag" },
  { id: "set_device_name", label: "Set Device Name" },
  { id: "archive_device", label: "Archive Device" },
  { id: "trigger_webhook", label: "Trigger HTTP Webhook" },
  { id: "wake_on_lan", label: "Wake-on-LAN Magic Packet" },
];

export default function WorkflowsPage() {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Builder Modal State
  const [showBuilder, setShowBuilder] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("NEW_DEVICE_DETECTED");
  const [conditions, setConditions] = useState<{ type: string; value: string; start?: string; end?: string }[]>([]);
  const [actions, setActions] = useState<any[]>([]);

  // Testing Modal State
  const [testingRule, setTestingRule] = useState<WorkflowRule | null>(null);
  const [testSimData, setTestSimData] = useState<string>('{\n  "vendor": "Apple",\n  "ip": "192.168.1.50",\n  "mac": "02:00:00:00:00:01"\n}');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testingInProgress, setTestingInProgress] = useState(false);

  // Execution Logs Drawer State
  const [logsRule, setLogsRule] = useState<WorkflowRule | null>(null);
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useScrollLock(Boolean(showBuilder || testingRule || logsRule));

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/workflows", {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggle = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/v1/workflows/${ruleId}/toggle`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, is_enabled: data.is_enabled } : r))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Delete this workflow rule?")) return;
    try {
      const res = await fetch(`/api/v1/workflows/${ruleId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
        showFeedback("Rule removed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formattedConditions = conditions.map((c) => {
        if (c.type === "time_between") {
          return { type: c.type, start: c.start || "08:00", end: c.end || "18:00" };
        }
        if (c.type === "is_randomized_mac") {
          return { type: c.type, value: String(c.value) === "true" };
        }
        return { type: c.type, value: c.value };
      });

      const res = await fetch("/api/v1/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: ruleName,
          is_enabled: true,
          trigger_event: triggerEvent,
          conditions_json: formattedConditions,
          actions_json: actions,
        }),
      });

      if (res.ok) {
        setShowBuilder(false);
        setRuleName("");
        setConditions([]);
        setActions([]);
        await fetchRules();
        showFeedback("Workflow rule created successfully");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openLogs = async (rule: WorkflowRule) => {
    setLogsRule(rule);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/v1/workflows/${rule.id}/logs`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const runRuleTest = async () => {
    if (!testingRule) return;
    setTestingInProgress(true);
    setTestResult(null);
    try {
      let parsedData = {};
      try {
        parsedData = JSON.parse(testSimData);
      } catch {
        alert("Invalid JSON format in test payload");
        setTestingInProgress(false);
        return;
      }

      const res = await fetch(`/api/v1/workflows/${testingRule.id}/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ event_data: parsedData }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTestingInProgress(false);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Condition builder helpers
  const addCondition = () => {
    setConditions([
      ...conditions,
      { type: "vendor_contains", value: "Apple" },
    ]);
  };

  const updateCondition = (index: number, key: string, val: any) => {
    setConditions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  // Action builder helpers
  const addAction = () => {
    setActions([
      ...actions,
      { action: "send_notification", message: "Alert: {name} ({mac}) detected on network" },
    ]);
  };

  const updateAction = (index: number, key: string, val: any) => {
    setActions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  const removeAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-sky-600 dark:text-sky-400" />
            Workflow Automation Engine
          </h1>
          <p className="text-muted text-sm mt-1">
            Build event-driven rules, automated classification, notification routing, and network actions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRules}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text rounded-lg border border-border transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg shadow-md shadow-sky-900/30"
          >
            <Plus className="w-4 h-4" />
            Create Workflow Rule
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-sky-950/80 border border-sky-800 text-sky-200 text-sm rounded-lg flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rules.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-surface/50 rounded-xl border border-border shadow-sm">
            <Zap className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-700 dark:text-slate-400 font-medium">No workflow automation rules configured</p>
            <p className="text-slate-500 dark:text-slate-600 text-xs mt-1">
              Create rules to auto-tag devices, trigger webhooks, or wake sleeping servers on LAN events
            </p>
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between shadow-sm ${
                rule.is_enabled
                  ? "bg-surface border-border hover:border-slate-300 dark:hover:border-slate-700"
                  : "bg-background/60 border-slate-200 dark:border-slate-900 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-semibold text-text text-base leading-snug">{rule.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 font-mono rounded-full font-bold">
                        {rule.trigger_event}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(rule.id)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                  >
                    {rule.is_enabled ? (
                      <ToggleRight className="w-7 h-7 text-sky-600 dark:text-sky-400" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-400 dark:text-slate-600" />
                    )}
                  </button>
                </div>

                {/* Conditions Summary */}
                <div className="space-y-1.5 my-3">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Conditions ({rule.conditions_json?.length || 0})
                  </span>
                  {rule.conditions_json && rule.conditions_json.length > 0 ? (
                    <div className="space-y-1">
                      {rule.conditions_json.map((c, i) => (
                        <div key={i} className="text-xs font-mono bg-background/70 px-2 py-1 rounded border border-border text-text truncate">
                          <span className="text-muted">{c.type}:</span> {String(c.value || `${c.start} to ${c.end}`)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted italic">Always executes on trigger</div>
                  )}
                </div>

                {/* Actions Summary */}
                <div className="space-y-1.5 my-3">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Actions ({rule.actions_json?.length || 0})
                  </span>
                  {rule.actions_json && rule.actions_json.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {rule.actions_json.map((a, i) => (
                        <span key={i} className="text-[10px] font-mono px-2 py-0.5 bg-hover border border-border text-text rounded">
                          {a.action}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted italic">No actions defined</div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-border/80 mt-4 flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  Ran {rule.execution_count} times
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTestingRule(rule);
                      setTestResult(null);
                    }}
                    className="p-1.5 hover:bg-hover text-sky-600 dark:text-sky-400 rounded-lg transition-colors font-medium flex items-center gap-1"
                    title="Simulate Event / Test"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Test
                  </button>
                  <button
                    onClick={() => openLogs(rule)}
                    className="p-1.5 hover:bg-hover text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors"
                    title="Execution Logs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Rule Builder */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-accent" />
                Workflow Rule Builder
              </h2>
              <button onClick={() => setShowBuilder(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-6 mt-4">
              {/* Basic Rule Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Notify on Unknown IoT Device"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400 focus:outline-hidden focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Trigger Event</label>
                  <select
                    value={triggerEvent}
                    onChange={(e) => setTriggerEvent(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-hidden focus:border-sky-500"
                  >
                    {TRIGGER_EVENTS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({t.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditions Section */}
              <div className="space-y-3 p-4 bg-background/60 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-accent" />
                    Conditions (All must match - AND)
                  </span>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 rounded font-medium flex items-center gap-1 border border-border transition"
                  >
                    <Plus className="w-3 h-3" /> Add Condition
                  </button>
                </div>

                {conditions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No conditions added (triggers on every event)</p>
                ) : (
                  conditions.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-surface p-2.5 rounded-lg border border-border">
                      <select
                        value={c.type}
                        onChange={(e) => updateCondition(idx, "type", e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs text-text"
                      >
                        {CONDITION_TYPES.map((ct) => (
                          <option key={ct.id} value={ct.id}>
                            {ct.label}
                          </option>
                        ))}
                      </select>

                      {c.type === "time_between" ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="time"
                            value={c.start || "08:00"}
                            onChange={(e) => updateCondition(idx, "start", e.target.value)}
                            className="bg-background border border-border rounded px-2 py-1 text-xs text-text"
                          />
                          <span className="text-slate-500 text-xs">to</span>
                          <input
                            type="time"
                            value={c.end || "18:00"}
                            onChange={(e) => updateCondition(idx, "end", e.target.value)}
                            className="bg-background border border-border rounded px-2 py-1 text-xs text-text"
                          />
                        </div>
                      ) : c.type === "is_randomized_mac" ? (
                        <select
                          value={c.value || "true"}
                          onChange={(e) => updateCondition(idx, "value", e.target.value)}
                          className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-text"
                        >
                          <option value="true">True (Locally Administered)</option>
                          <option value="false">False (Standard OEM OUI)</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Value"
                          value={c.value || ""}
                          onChange={(e) => updateCondition(idx, "value", e.target.value)}
                          className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-text"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => removeCondition(idx)}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Actions Section */}
              <div className="space-y-3 p-4 bg-background/60 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    Actions to Execute
                  </span>
                  <button
                    type="button"
                    onClick={addAction}
                    className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 rounded font-medium flex items-center gap-1 border border-border transition"
                  >
                    <Plus className="w-3 h-3" /> Add Action
                  </button>
                </div>

                {actions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No actions defined</p>
                ) : (
                  actions.map((act, idx) => (
                    <div key={idx} className="bg-surface p-3 rounded-lg border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <select
                          value={act.action}
                          onChange={(e) => updateAction(idx, "action", e.target.value)}
                          className="bg-background border border-border rounded px-2 py-1 text-xs text-text font-medium"
                        >
                          {ACTION_TYPES.map((at) => (
                            <option key={at.id} value={at.id}>
                              {at.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeAction(idx)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Action parameters */}
                      {act.action === "send_notification" && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Message Template (supports {name}, {mac}, {ip})"
                            value={act.message || ""}
                            onChange={(e) => updateAction(idx, "message", e.target.value)}
                            className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-text placeholder-slate-400"
                          />
                          <div className="flex gap-2">
                            <select
                              value={act.severity || "INFO"}
                              onChange={(e) => updateAction(idx, "severity", e.target.value)}
                              className="bg-background border border-border rounded px-2 py-1 text-xs text-text"
                            >
                              <option value="INFO">Severity: INFO</option>
                              <option value="WARNING">Severity: WARNING</option>
                              <option value="CRITICAL">Severity: CRITICAL</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {act.action === "assign_category" && (
                        <input
                          type="text"
                          placeholder="Category (e.g. IoT/Smart Home, Mobile, Server)"
                          value={act.category || ""}
                          onChange={(e) => updateAction(idx, "category", e.target.value)}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-text placeholder-slate-400"
                        />
                      )}

                      {act.action === "add_tag" && (
                        <input
                          type="text"
                          placeholder="Tag string (e.g. guest-network, vip, suspicious)"
                          value={act.tag || ""}
                          onChange={(e) => updateAction(idx, "tag", e.target.value)}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-text placeholder-slate-400"
                        />
                      )}

                      {act.action === "set_device_name" && (
                        <input
                          type="text"
                          placeholder="Device Name Template"
                          value={act.name || ""}
                          onChange={(e) => updateAction(idx, "name", e.target.value)}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-text placeholder-slate-400"
                        />
                      )}

                      {act.action === "trigger_webhook" && (
                        <input
                          type="url"
                          placeholder="Endpoint URL (https://...)"
                          value={act.url || ""}
                          onChange={(e) => updateAction(idx, "url", e.target.value)}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-text placeholder-slate-400"
                        />
                      )}

                      {act.action === "wake_on_lan" && (
                        <input
                          type="text"
                          placeholder="MAC address (or leave empty to use triggering device)"
                          value={act.mac || ""}
                          onChange={(e) => updateAction(idx, "mac", e.target.value)}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-text font-mono placeholder-slate-400"
                        />
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowBuilder(false)}
                  className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text rounded-lg border border-border transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white font-medium rounded-lg shadow-sm transition"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rule Simulation & Test */}
      {testingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                <Play className="w-5 h-5 text-accent" />
                Simulate Rule: {testingRule.name}
              </h2>
              <button onClick={() => setTestingRule(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Simulated Event Payload (JSON)
                </label>
                <textarea
                  rows={5}
                  value={testSimData}
                  onChange={(e) => setTestSimData(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-3 text-xs font-mono text-text placeholder-slate-400 focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={runRuleTest}
                  disabled={testingInProgress}
                  className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white font-medium rounded-lg flex items-center gap-2 shadow-sm transition"
                >
                  <Play className={`w-4 h-4 ${testingInProgress ? "animate-spin" : ""}`} />
                  {testingInProgress ? "Evaluating..." : "Evaluate Rule"}
                </button>
              </div>

              {testResult && (
                <div className="p-4 bg-background/80 rounded-xl border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">Rule Match Outcome:</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                        testResult.matched ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-status-online border border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                      }`}
                    >
                      {testResult.matched ? "MATCHED" : "NO MATCH"}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-muted space-y-1">
                    {testResult.condition_evaluations?.map((ce: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span>{ce.condition.type}:</span>
                        <span className={ce.matched ? "text-status-online" : "text-red-600 dark:text-red-400"}>
                          {ce.matched ? "✓ PASS" : "✗ FAIL"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {testResult.matched && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-xs text-muted font-semibold block mb-1">Actions Executed:</span>
                      <pre className="text-[10px] text-indigo-700 dark:text-sky-300 bg-surface border border-border p-2 rounded overflow-x-auto">
                        {JSON.stringify(testResult.action_results, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Execution Logs */}
      {logsRule && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-border p-6 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                Execution History
              </h2>
              <p className="text-xs text-muted truncate max-w-xs">{logsRule.name}</p>
            </div>
            <button onClick={() => setLogsRule(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {loadingLogs ? (
              <p className="text-center text-slate-500 text-xs py-8">Loading logs...</p>
            ) : logs.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-8">No execution history recorded</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-3 bg-background/70 border border-border rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-accent">{log.trigger_event}</span>
                    <span className="text-muted">{new Date(log.executed_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-muted">
                    Matched: <span className="text-text font-medium">{log.matched ? "Yes" : "No"}</span>
                  </div>
                  {log.actions_executed && log.actions_executed.length > 0 && (
                    <div className="pt-1">
                      <span className="text-slate-500 block">Actions:</span>
                      <pre className="text-[10px] text-text bg-surface border border-border p-1.5 rounded overflow-x-auto mt-0.5">
                        {JSON.stringify(log.actions_executed, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.error_message && (
                    <div className="text-red-600 dark:text-red-400 text-[11px] pt-1 font-mono">
                      Error: {log.error_message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
