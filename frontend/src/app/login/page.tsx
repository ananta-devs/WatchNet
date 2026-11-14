"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Radar, Lock, User, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const ok = await login(identifier, password);
      if (!ok) {
        setError("Invalid username/email or password.");
      }
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center mb-3">
            <Radar className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-text tracking-wide">WATCHNET</h1>
          <p className="text-sm text-muted mt-1">Enterprise Network Security Suite</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-status-critical/10 border border-status-critical/20 rounded-lg flex items-center gap-3 text-status-critical text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Username or Email
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-muted" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin"
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text text-sm focus:outline-none focus:border-accent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-muted" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text text-sm focus:outline-none focus:border-accent transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg text-sm transition flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted">
          WatchNet Release Candidate v1.0.0-rc.1
        </div>
      </div>
    </div>
  );
}
