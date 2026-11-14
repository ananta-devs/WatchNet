"use client";

import React, { useState, useEffect } from "react";
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
  ChevronLeft,
  ChevronRight,
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
  
  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);
  // Tablet/Desktop sidebar collapsed state (saved in localStorage)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useScrollLock(mobileOpen);

  // Load sidebar preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("watchnet_sidebar_collapsed");
      if (saved === "true") {
        setDesktopCollapsed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebarCollapse = () => {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("watchnet_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard accessibility: Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // If on login page, render bare children without sidebar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background text-text transition-colors duration-150">
      {/* Desktop / Tablet Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 shrink-0 border-r border-border bg-sidebar overflow-hidden select-none transition-all duration-200 ease-in-out ${
          desktopCollapsed ? "w-16" : "w-60 lg:w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-14 px-3.5 lg:px-4 border-b border-border shrink-0 bg-sidebar">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white shadow-xs shrink-0">
              <Radar className="w-4 h-4 text-white" />
            </div>
            {!desktopCollapsed && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm tracking-wide text-text truncate">
                  WATCHNET
                </span>
                <span className="text-[10px] font-mono text-muted uppercase tracking-wider truncate">
                  ENTERPRISE v1.0
                </span>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebarCollapse}
            className="p-1 rounded-md text-muted hover:text-text hover:bg-hover transition cursor-pointer"
            title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-2 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={desktopCollapsed ? item.title : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? "bg-accent text-white font-semibold shadow-xs"
                    : "text-muted hover:bg-hover hover:text-text"
                } ${desktopCollapsed ? "justify-center px-0" : ""}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-muted"}`} />
                {!desktopCollapsed && <span className="truncate">{item.title}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Drawer Backdrop and Navigation */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu backdrop"
          />
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full bg-sidebar border-r border-border shadow-2xl z-10 safe-pb safe-pt">
            <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0 bg-sidebar">
              <div className="flex items-center gap-3">
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
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 text-muted hover:text-text rounded-md hover:bg-hover min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
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
                    className={`flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors min-h-[44px] ${
                      active
                        ? "bg-accent text-white font-semibold shadow-xs"
                        : "text-muted hover:bg-hover hover:text-text"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-muted"}`} />
                    <span className="truncate text-sm">{item.title}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Mobile drawer footer user profile info */}
            <div className="p-3 border-t border-border flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-7 h-7 rounded-full bg-hover border border-border flex items-center justify-center font-bold text-xs text-accent shrink-0">
                  {(user?.username || "A").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-semibold text-text truncate">{user?.username || "Admin"}</span>
                  <span className="text-[10px] text-muted truncate">{user?.role || "Administrator"}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="p-2 text-muted hover:text-status-critical rounded-md border border-border hover:bg-hover transition cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 flex items-center justify-between px-3 sm:px-6 border-b border-border bg-surface safe-pt">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-muted hover:text-text rounded-md hover:bg-hover min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Mobile Brand Identity Indicator */}
            <div className="flex md:hidden items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center text-white">
                <Radar className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-xs tracking-wider text-text">WATCHNET</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            {/* Quick Toggle Button (Maintains backward compatibility with test selector) */}
            <button
              onClick={() => toggleTheme()}
              className="p-2 text-muted hover:text-accent rounded-lg border border-border hover:bg-hover transition-all flex items-center gap-2 text-xs font-medium cursor-pointer min-h-[38px]"
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
              className="hidden sm:flex items-center p-0.5 bg-background rounded-lg border border-border"
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
                <span className="hidden md:inline">Light</span>
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
                <span className="hidden md:inline">Dark</span>
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
                <span className="hidden md:inline">System</span>
              </button>
            </div>

            <div className="h-5 w-px bg-border hidden sm:block" />

            {/* User Profile and Sign Out */}
            <div className="flex items-center gap-2 sm:gap-3">
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
                className="p-1.5 text-muted hover:text-status-critical rounded-md border border-border hover:bg-hover transition cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-5 md:p-6 overflow-y-auto bg-background safe-pb">
          {children}
        </main>
      </div>
    </div>
  );
};
