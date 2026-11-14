# WatchNet Release Notes — v1.0.0-rc.1

**Product:** WatchNet Enterprise Network Intelligence & Monitoring  
**Release Tag:** `v1.0.0-rc.1`  
**Milestone:** Release Candidate 1  
**Date:** November 12, 2026  
**License:** GNU General Public License v3.0 (GPL-3.0)  

---

## 1. Executive Summary

WatchNet `v1.0.0-rc.1` is the first formal Release Candidate for WatchNet — a clean-room, decoupled, modern enterprise successor to WatchNet. Built with asynchronous Python 3.14 (FastAPI), Go 1.27 (raw socket collector), Next.js 16 (React 19 / Turbopack), PostgreSQL 16, Redis 7, and Caddy 2, WatchNet achieves full architectural and functional parity with legacy upstream while providing enterprise reliability, role-based security, modular router intelligence, and parental control features.

---

## 2. Key Highlights & Achievements

### 2.1 Complete Upstream Plugin & Feature Reconciliation
- **56 Upstream Plugins Fully Cataloged:** Audited against upstream repository `server/plugins/`.
- **Zero Omitted Capabilities:** 54 production capabilities consolidated into 36 modular clean-room adapters and core services, plus 2 base/developer testing harnesses (`__template`, `__test`).
- **Validated Adapters:** Discovery (15), Monitoring (5), Name Resolution (3), Notifications (8), and System (5).

### 2.2 Transparent Router Intelligence & Integration Levels
- Introduced 4 explicit integration tiers:
  1. `Full API Integration` (`full_api`): Bidirectional telemetry, live client tables, Wi-Fi RSSI, frequency band, TX/RX counters, DHCP lease times (e.g. UniFi OS, Omada SDN OpenAPI).
  2. `Read-Only API Integration` (`read_only_api`): Read-only REST, TR-064, or JSON-RPC client polling (e.g. OpenWrt LuCI, ASUSWRT, FRITZ!Box, MikroTik RouterOS).
  3. `Passive Network Discovery` (`passive_discovery`): L2 ARP sweeps, ICMP ping sweeps, DNS PTR reverse lookups, and kernel IP neighbor table ingestion (`ip neigh`).
  4. `Direct API Unsupported` (`unsupported`): Documented for routers with proprietary encrypted stock firmware (such as TP-Link TL-WR841N v14 running `INCLUDE_LOGIN_GDPR_ENCRYPT=1`).
- Fail-Open Decoupling: Direct router API authentication failures never degrade local subnet discovery.

### 2.3 Layer-2 & Layer-3 Network Discovery Engine
- Autonomous Go collector daemon utilizing raw sockets (`CAP_NET_RAW` / `CAP_NET_ADMIN`).
- Class C subnet (`/24`) ARP sweep completes in under 700 ms.
- Concurrent ICMP worker pool sweeps 254 hosts in ~820 ms.
- Real-world validation against physical subnet `192.168.0.0/24` with local host `192.168.0.102` accurately cataloging gateway and client stations.
- RFC 7042 Locally Administered Address (LAA) randomized MAC address identification.

### 2.4 Browser User Experience (Next.js 16 Turbopack)
- 18 production sections covering: Overview Dashboard, Device Inventory, Device Details with 24-hour presence heatmap, Network Discovery, Network Topology canvas, Monitoring, Wallboard NOC Kiosk, Routers, DNS Intelligence, Family Safety, Activity Feed, Notifications, Workflows, Integrations, Plugins, Reports, Health, and Settings.
- Responsive mobile and desktop navigation with dark/light themes.

### 2.5 Security & Release Hardening
- Argon2id password hashing with constant-time verification.
- Short-lived HMAC-SHA256 JWT access tokens paired with HttpOnly, Secure, SameSite=Lax cookie transport.
- AES-256-GCM envelope encryption protecting stored router and webhook credentials.
- 5-tier Role-Based Access Control (Owner, Administrator, Operator, Viewer, Guest).
- Container runtime runs strictly as unprivileged UID `10001:10001` with read-only root filesystems.

---

## 3. Legacy Upstream Plugin Reconciliation Matrix

| Category | Upstream Plugins | WatchNet Modern Implementation |
|:---|:---:|:---|
| **Discovery** | 11 | `collector/internal/discovery/` & `backend/app/services/plugins/adapters/discovery.py` |
| **Routers** | 9 | `backend/app/services/routers/` (UniFi, OpenWrt, ASUSWRT, FRITZ!, MikroTik, Omada) |
| **Notifications** | 10 | `backend/app/services/plugins/adapters/notifications.py` (8 publishers + router) |
| **System** | 11 | `backend/app/services/plugins/adapters/system.py` & `backend/app/services/system/` |
| **Monitoring** | 5 | `collector/internal/discovery/icmp.go` & `backend/app/services/monitoring/` |
| **Name Resolution** | 4 | `backend/app/services/plugins/adapters/name_resolution.py` |
| **DNS / Filtering** | 4 | `backend/app/services/family/` (AdGuard Home & Pi-hole) |
| **Workflows** | 1 | `backend/app/services/workflows/workflow_engine.py` |
| **Multi-Site** | 1 | `backend/app/services/multisite/sync_service.py` |
| **Total** | **56** | **All 56 accounted for (36 modular adapters + core services + 2 test bases)** |

---

## 4. Verification Evidence

- **Backend Pytest Suite:** 47 passed / 0 failed (100% pass rate in backend test suite).
- **Go Collector Unit Tests:** 100% pass across all packages (`config`, `discovery`, `events`).
- **Frontend Turbopack Build:** 25/25 routes compiled successfully in 1.2s.
- **Playwright E2E Browser Suite:** 30 passed / 0 failed across 9 specifications.
- **Physical Router Verification:** TP-Link TL-WR841N v14 discovered via L2/L3 with stock firmware encryption constraints transparently reported.

---

## 5. Upgrade & Migration Notices

- Direct upgrade from legacy network system SQLite flat databases is supported via the Device CSV Import/Export utility (`/settings`) or through the automated backup restore API (`/api/v1/system/restore`).
- Database schema migrations are managed via Alembic revisions `0001` through `0005`.
