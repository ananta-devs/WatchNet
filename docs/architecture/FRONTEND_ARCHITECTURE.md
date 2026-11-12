# WatchNet Frontend Architecture

**Document Version:** 1.0.0  
**Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query v5  

---

## 1. UI Framework and Design System

The WatchNet web frontend replaces legacy PHP AdminLTE templates with a modern, high-performance React application designed for responsiveness, accessibility, and real-time state synchronization.

### 1.1 Key Frontend Technologies
- **Next.js 14 App Router**: Server Components for instant page loads and Client Components for dynamic dashboard interactivity.
- **Tailwind CSS v4 & shadcn/ui**: Component library with dark/light mode, accessible primitives (Radix UI), and zero CSS bloat.
- **TanStack Query (React Query v5)**: Efficient client-side cache management, automatic background refetching, and optimistic UI mutations.
- **Lucide Icons**: Standardized modern iconography for device categories, status indicators, and network protocols.
- **Recharts & Visx**: Interactive presence heatmaps, latency sparklines, bandwidth charts, and network topology maps.

---

## 2. Page & View Hierarchy

- `/dashboard`: Executive network health overview, active host counts, WAN status gauge, presence activity heatmap, and recent alert feed.
- `/devices`: Paginated, sortable, filterable device inventory table with live status badges, custom tag management, and quick actions.
- `/devices/[id]`: Comprehensive device inspection workbench showing connection history, port scan results, DHCP lease timeline, and DNS policies.
- `/topology`: Interactive network topology map depicting switch ports, AP associations, and wireless client links.
- `/integrations`: Configuration and sync center for routers (UniFi, OpenWrt, MikroTik), DNS blockers (Pi-hole, AdGuard), and notification publishers.
- `/parental-controls`: Transparent family profiles, device grouping, DNS content filtering rules, and scheduled downtime controls.
- `/diagnostics`: Network tool suite (Ping, Traceroute, Port Scanner, Speedtest, Wake-on-LAN).
- `/settings`: System configuration, user management, RBAC assignments, backup/restore, and audit logs.
