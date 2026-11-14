"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  LayoutDashboard,
  Smartphone,
  Radar,
  Network,
  Activity,
  Router as RouterIcon,
  FileClock,
  ShieldCheck,
  Users,
  Bell,
  GitBranch,
  Plug,
  Boxes,
  Globe,
  FileSpreadsheet,
  Terminal,
  HeartPulse,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Devices", href: "/devices", icon: Smartphone },
  { title: "Network Discovery", href: "/discovery", icon: Radar },
  { title: "Topology", href: "/topology", icon: Network },
  { title: "Monitoring", href: "/monitoring", icon: Activity },
  { title: "Routers", href: "/routers", icon: RouterIcon },
  { title: "Activity", href: "/activity", icon: FileClock },
  { title: "DNS Intelligence", href: "/dns", icon: ShieldCheck },
  { title: "Family Safety", href: "/family-safety", icon: Users },
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Workflows", href: "/workflows", icon: GitBranch },
  { title: "Integrations", href: "/integrations", icon: Plug },
  { title: "Plugins", href: "/plugins", icon: Boxes },
  { title: "Multi-Site", href: "/multisite", icon: Globe },
  { title: "Reports", href: "/reports", icon: FileSpreadsheet },
  { title: "API / Dev Tools", href: "/api-docs", icon: Terminal },
  { title: "System Health", href: "/health", icon: HeartPulse },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const Shell = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  useScrollLock(mobileOpen);

  // If on login page, render bare children without sidebar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background text-text transition-colors duration-150">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 shrink-0 border-r border-border bg-sidebar overflow-hidden select-none">
        <div className="flex items-center gap-3 h-14 px-5 border-b border-border shrink-0 bg-sidebar">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white shadow-xs">
            <Radar className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-wide text-text">
              WATCHNET
            </span>
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
              ENTERPRISE v1.0
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? "bg-accent text-white font-semibold shadow-xs"
                    : "text-muted hover:bg-hover hover:text-text"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-muted"}`} />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Drawer Backdrop and Navigation */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu backdrop"
          />
          <aside className="relative flex flex-col w-64 max-w-[80vw] h-full bg-sidebar border-r border-border shadow-xl z-10">
            <div className="flex items-center justify-between h-14 px-5 border-b border-border shrink-0 bg-sidebar">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white shadow-xs">
                  <Radar className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-sm tracking-wide text-text">
                  WATCHNET
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-muted hover:text-text rounded-md hover:bg-hover"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      active
                        ? "bg-accent text-white font-semibold"
                        : "text-muted hover:bg-hover hover:text-text"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-muted"}`} />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border bg-surface">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-muted hover:text-text rounded-md hover:bg-hover"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-4 ml-auto">
            {/* Quick Toggle Button (Maintains backward compatibility with test selector) */}
            <button
              onClick={() => toggleTheme()}
              className="p-2 text-muted hover:text-accent rounded-lg border border-border hover:bg-hover transition-all flex items-center gap-2 text-xs font-medium cursor-pointer"
              title="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-accent" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            {/* Theme Switcher Segmented Control (Light / Dark / System) */}
            <div
              className="flex items-center p-0.5 bg-background rounded-lg border border-border"
              role="radiogroup"
              aria-label="Theme selection"
            >
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-surface text-accent shadow-xs font-semibold"
                    : "text-muted hover:text-text"
                }`}
                title="Light mode"
                aria-checked={theme === "light"}
                role="radio"
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-surface text-accent shadow-xs font-semibold"
                    : "text-muted hover:text-text"
                }`}
                title="Dark mode"
                aria-checked={theme === "dark"}
                role="radio"
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  theme === "system"
                    ? "bg-surface text-accent shadow-xs font-semibold"
                    : "text-muted hover:text-text"
                }`}
                title="System theme"
                aria-checked={theme === "system"}
                role="radio"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">System</span>
              </button>
            </div>

            <div className="h-5 w-px bg-border" />

            {/* User Profile and Sign Out */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-hover border border-border flex items-center justify-center font-bold text-xs text-accent">
                  {(user?.username || "A").slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-semibold text-text leading-tight">{user?.username || "Admin"}</span>
                  <span className="text-[10px] text-muted leading-tight">{user?.role || "Administrator"}</span>
                </div>
              </div>

              <button
                onClick={() => logout()}
                className="p-1.5 text-muted hover:text-status-critical rounded-md border border-border hover:bg-hover transition cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
};
