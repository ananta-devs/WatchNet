"use client";

import React, { useState, useEffect } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Check,
  Send,
  Plus,
  Trash2,
  RefreshCw,
  Mail,
  MessageSquare,
  Globe,
  Radio,
  Share2,
  X
} from "lucide-react";

interface InAppNotification {
  id: string;
  title: string;
  message: string;
  severity: string;
  event_type: string;
  is_read: boolean;
  device_id: string | null;
  created_at: string;
}

interface NotificationChannel {
  id: string;
  name: string;
  channel_type: string;
  is_enabled: boolean;
  config_json: Record<string, any>;
  min_severity: string;
  created_at: string;
}

const CHANNEL_TYPES = [
  { id: "telegram", label: "Telegram Bot", icon: MessageSquare },
  { id: "email", label: "SMTP Email", icon: Mail },
  { id: "webhook", label: "Generic Webhook", icon: Globe },
  { id: "ntfy", label: "ntfy Push", icon: Radio },
  { id: "mqtt", label: "MQTT Broker", icon: Share2 },
  { id: "pushover", label: "Pushover", icon: Bell },
  { id: "pushsafer", label: "Pushsafer", icon: Bell },
  { id: "apprise", label: "Apprise (80+ services)", icon: Share2 },
];

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<"inbox" | "channels">("inbox");
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Channel Modal
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState("telegram");
  const [newChannelMinSev, setNewChannelMinSev] = useState("INFO");
  const [configFields, setConfigFields] = useState<Record<string, any>>({});
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);

  useScrollLock(showChannelModal);

  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchInbox = async () => {
    try {
      const res = await fetch("/api/v1/notifications?limit=100", {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/v1/notifications/channels", {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setChannels(data || []);
      }
    } catch (err) {
      console.error("Failed to load channels:", err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchInbox(), fetchChannels()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/notifications/${id}/read`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch("/api/v1/notifications/read-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
        showFeedback("All alerts marked as read");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/notifications/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: newChannelName,
          channel_type: newChannelType,
          is_enabled: true,
          min_severity: newChannelMinSev,
          config_json: configFields,
        }),
      });
      if (res.ok) {
        setShowChannelModal(false);
        setNewChannelName("");
        setConfigFields({});
        await fetchChannels();
        showFeedback("Channel created successfully");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification channel?")) return;
    try {
      const res = await fetch(`/api/v1/notifications/channels/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== id));
        showFeedback("Channel removed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestChannel = async (id: string) => {
    setTestingChannelId(id);
    try {
      const res = await fetch("/api/v1/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ channel_id: id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback("Test alert sent successfully!");
      } else {
        showFeedback("Test alert failed: " + (data.detail || "check server logs"));
      }
    } catch (err) {
      showFeedback("Failed to send test: " + String(err));
    } finally {
      setTestingChannelId(null);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev.toUpperCase()) {
      case "CRITICAL":
        return <AlertOctagon className="w-5 h-5 text-red-400" />;
      case "WARNING":
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      default:
        return <Info className="w-5 h-5 text-sky-400" />;
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-text flex items-center gap-2.5 sm:gap-3">
            <Bell className="w-6 h-6 sm:w-8 sm:h-8 text-accent shrink-0" />
            <span>Notifications & Dispatch</span>
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-1">
            Real-time in-app alerts, severity filtering, and multi-channel publisher delivery
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={loadAll}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3 py-2 text-xs sm:text-sm bg-surface hover:bg-hover text-text rounded-lg border border-border transition cursor-pointer min-h-[38px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {activeTab === "inbox" && (
            <button
              onClick={markAllRead}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3 py-2 text-xs sm:text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium shadow-xs cursor-pointer min-h-[38px]"
            >
              <Check className="w-4 h-4" />
              Mark All Read
            </button>
          )}
          {activeTab === "channels" && (
            <button
              onClick={() => setShowChannelModal(true)}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3 py-2 text-xs sm:text-sm bg-accent hover:bg-accent-hover text-white rounded-lg font-medium shadow-xs cursor-pointer min-h-[38px]"
            >
              <Plus className="w-4 h-4" />
              Add Delivery Channel
            </button>
          )}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className="p-3 bg-sky-950/80 border border-sky-800 text-sky-200 text-sm rounded-lg flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab("inbox")}
          className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === "inbox" ? "text-accent border-b-2 border-indigo-600 dark:border-sky-400" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Bell className="w-4 h-4" />
          In-App Alerts
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full font-bold">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("channels")}
          className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === "channels" ? "text-accent border-b-2 border-indigo-600 dark:border-sky-400" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Send className="w-4 h-4" />
          Delivery Channels ({channels.length})
        </button>
      </div>

      {/* Tab 1: Inbox */}
      {activeTab === "inbox" && (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="p-12 text-center bg-surface/50 rounded-xl border border-border shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-700 dark:text-slate-400 font-medium">No alerts recorded</p>
              <p className="text-slate-500 dark:text-slate-600 text-xs mt-1">Network events will appear here in real time</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-xl border transition-all flex items-start gap-4 shadow-sm ${
                  n.is_read
                    ? "bg-surface/40 border-border/80 text-text"
                    : "bg-indigo-50/50 dark:bg-slate-850 border-indigo-200 dark:border-sky-800/50 shadow-md text-text"
                }`}
              >
                <div className="pt-0.5">{getSeverityIcon(n.severity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{n.title}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-hover border border-border text-muted rounded-full font-mono uppercase">
                      {n.event_type}
                    </span>
                    <span className="text-xs text-muted ml-auto">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted leading-relaxed">{n.message}</p>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    title="Mark as read"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-sky-400 hover:bg-hover rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Channels */}
      {activeTab === "channels" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-surface/50 rounded-xl border border-border shadow-sm">
              <Send className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-700 dark:text-slate-400 font-medium">No notification channels configured</p>
              <p className="text-slate-500 dark:text-slate-600 text-xs mt-1">
                Add Telegram, SMTP email, Webhooks, or Apprise to receive remote alerts
              </p>
            </div>
          ) : (
            channels.map((ch) => {
              const matchedType = CHANNEL_TYPES.find((t) => t.id === ch.channel_type);
              const IconComp = matchedType ? matchedType.icon : Send;

              return (
                <div
                  key={ch.id}
                  className="p-5 bg-surface border border-border rounded-xl flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/40 rounded-lg text-sky-600 dark:text-sky-400">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-medium text-text text-sm">{ch.name}</h3>
                          <span className="text-xs text-slate-500 uppercase font-mono">
                            {ch.channel_type}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          ch.min_severity === "CRITICAL"
                            ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                            : ch.min_severity === "WARNING"
                            ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                            : "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800"
                        }`}
                      >
                        {ch.min_severity}+
                      </span>
                    </div>

                    <div className="text-xs text-muted space-y-1 font-mono bg-background/60 p-2.5 rounded-lg border border-border/80 mb-4 overflow-hidden">
                      {Object.keys(ch.config_json || {}).length === 0 ? (
                        <span className="text-slate-400 dark:text-slate-600">No extra parameters</span>
                      ) : (
                        Object.entries(ch.config_json).map(([k, v]) => (
                          <div key={k} className="truncate">
                            <span className="text-slate-500">{k}:</span>{" "}
                            <span>{k.includes("key") || k.includes("pass") || k.includes("token") ? "••••••••" : String(v)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <button
                      onClick={() => handleTestChannel(ch.id)}
                      disabled={testingChannelId === ch.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 rounded-lg border border-border font-medium transition-colors"
                    >
                      <Send className={`w-3.5 h-3.5 ${testingChannelId === ch.id ? "animate-pulse" : ""}`} />
                      {testingChannelId === ch.id ? "Testing..." : "Send Test Alert"}
                    </button>
                    <button
                      onClick={() => handleDeleteChannel(ch.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal: Add Channel */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4" role="dialog" aria-modal="true">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h2 className="text-base sm:text-lg font-bold text-text flex items-center gap-2">
                <Send className="w-5 h-5 text-accent" />
                Configure Delivery Channel
              </h2>
              <button
                onClick={() => setShowChannelModal(false)}
                className="text-muted hover:text-text cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-text mb-1">Channel Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SOC Telegram Alerts"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400 focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Channel Type</label>
                  <select
                    value={newChannelType}
                    onChange={(e) => {
                      setNewChannelType(e.target.value);
                      setConfigFields({});
                    }}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-hidden focus:border-sky-500"
                  >
                    {CHANNEL_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Min Severity</label>
                  <select
                    value={newChannelMinSev}
                    onChange={(e) => setNewChannelMinSev(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-hidden focus:border-sky-500"
                  >
                    <option value="INFO">INFO (All alerts)</option>
                    <option value="WARNING">WARNING & Above</option>
                    <option value="CRITICAL">CRITICAL Only</option>
                  </select>
                </div>
              </div>

              {/* Dynamic inputs based on channel type */}
              <div className="p-4 bg-background/60 rounded-xl border border-border space-y-3">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                  Channel Settings ({newChannelType})
                </span>

                {newChannelType === "telegram" && (
                  <>
                    <input
                      type="text"
                      placeholder="Telegram Bot Token"
                      value={configFields.bot_token || ""}
                      onChange={(e) => setConfigFields({ ...configFields, bot_token: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Chat ID (e.g. -1001234567)"
                      value={configFields.chat_id || ""}
                      onChange={(e) => setConfigFields({ ...configFields, chat_id: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                    />
                  </>
                )}

                {newChannelType === "email" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="SMTP Host"
                        value={configFields.smtp_host || ""}
                        onChange={(e) => setConfigFields({ ...configFields, smtp_host: e.target.value })}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                      />
                      <input
                        type="number"
                        placeholder="Port (587)"
                        value={configFields.smtp_port || 587}
                        onChange={(e) => setConfigFields({ ...configFields, smtp_port: Number(e.target.value) })}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Recipient Email"
                      value={configFields.recipient || ""}
                      onChange={(e) => setConfigFields({ ...configFields, recipient: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                    />
                  </>
                )}

                {newChannelType === "webhook" && (
                  <>
                    <input
                      type="url"
                      placeholder="Webhook Target URL"
                      value={configFields.webhook_url || ""}
                      onChange={(e) => setConfigFields({ ...configFields, webhook_url: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Secret (for HMAC signature header, optional)"
                      value={configFields.secret || ""}
                      onChange={(e) => setConfigFields({ ...configFields, secret: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                    />
                  </>
                )}

                {newChannelType === "ntfy" && (
                  <>
                    <input
                      type="url"
                      placeholder="Server URL (default: https://ntfy.sh)"
                      value={configFields.server_url || ""}
                      onChange={(e) => setConfigFields({ ...configFields, server_url: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Topic Name"
                      value={configFields.topic || ""}
                      onChange={(e) => setConfigFields({ ...configFields, topic: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                    />
                  </>
                )}

                {newChannelType === "mqtt" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Broker Host"
                        value={configFields.broker_host || ""}
                        onChange={(e) => setConfigFields({ ...configFields, broker_host: e.target.value })}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                      />
                      <input
                        type="number"
                        placeholder="Broker Port (1883)"
                        value={configFields.broker_port || 1883}
                        onChange={(e) => setConfigFields({ ...configFields, broker_port: Number(e.target.value) })}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Topic (e.g. watchnet/events)"
                      value={configFields.topic || ""}
                      onChange={(e) => setConfigFields({ ...configFields, topic: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                    />
                  </>
                )}

                {newChannelType === "pushover" && (
                  <>
                    <input
                      type="text"
                      placeholder="User Key"
                      value={configFields.user_key || ""}
                      onChange={(e) => setConfigFields({ ...configFields, user_key: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="App API Token"
                      value={configFields.app_token || ""}
                      onChange={(e) => setConfigFields({ ...configFields, app_token: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                    />
                  </>
                )}

                {newChannelType === "pushsafer" && (
                  <input
                    type="text"
                    placeholder="Private or Alias Key"
                    value={configFields.private_key || ""}
                    onChange={(e) => setConfigFields({ ...configFields, private_key: e.target.value })}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                  />
                )}

                {newChannelType === "apprise" && (
                  <input
                    type="text"
                    placeholder="Apprise URLs (comma separated, e.g. discord://..., slack://...)"
                    value={configFields.apprise_urls || ""}
                    onChange={(e) => setConfigFields({ ...configFields, apprise_urls: e.target.value })}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-slate-400"
                  />
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowChannelModal(false)}
                  className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text rounded-lg border border-border transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white font-medium rounded-lg shadow-sm transition"
                >
                  Save Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
