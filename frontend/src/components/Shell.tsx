"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // If on login page, render bare children without sidebar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className={`min-h-screen flex ${darkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3 h-16 px-6 border-b border-slate-800">
          <Radar className="w-6 h-6 text-indigo-400" />
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-wider text-indigo-400 leading-none">WATCHNET</span>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">v1.0.0-rc.1</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold">{user?.username || "Admin"}</span>
            <span className="text-[10px] text-slate-500">{user?.role || "Administrator"}</span>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-white"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
