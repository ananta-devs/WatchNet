# WatchNet Rebuild 002 — Initial Baseline Assessment

**Task ID:** WATCHNET-002  
**Baseline Date:** 2026-11-12  
**Workspace:** `D:\WatchNet`  
**Reference Benchmark:** `D:\WatchNet-Legacy-Baseline`  
**Governance State:** Plan First → Implement → Test → Fix → Retest → Acceptance

---

## 1. Verified Safety & Snapshot Status

Prior to any modifications or runtime testing, the existing workspace baseline and external recovery mirrors were verified:

| Artifact | Location | Verification Status | Files / Size |
| :--- | :--- | :--- | :--- |
| **Full Directory Mirror** | `D:\WatchNet_backup_20261112_130000` | **VERIFIED INTACT** | 17,475 files, 941.06 MB |
| **Compressed Snapshot** | `D:\WatchNet_snapshot_20261112_130000.zip` | **VERIFIED INTACT** | 3,721 files, 128.80 MB |
| **Git Working Tree** | `D:\WatchNet` | Clean, untracked modern rebuild | `apps/`, `docs/`, `infrastructure/`, `services/`, `.gitignore` |

---

## 2. Current Implementation Baseline

### 2.1 Backend Services (`services/api`)
- **Framework:** FastAPI with Python 3.11/3.13 (`pydantic` v2, `sqlalchemy` v2 async).
- **ORM Models:**
  - `Organization`, `Site`, `UserAccount`, `RevokedToken`
  - `Device`, `DeviceNetworkInterface`, `DeviceIPAddress`, `DeviceCustomLink`, `DeviceTag`
  - `PresenceHourlyAggregate`, `DeviceStateTransition`, `DeviceSession`
  - `ProbeTarget`, `ProbeResult`, `DeviceAvailabilityCheck`, `MaintenanceWindow`
  - `AlertRule`, `AlertInstance`, `NotificationChannel`, `NotificationLog`
  - `NetworkIntegration` (UniFi, Omada, Pi-hole, AdGuard, MQTT, Webhook)
  - `PluginExecutionPolicy`, `PluginLog`
  - `AuditLog`
- **Core Security Modules:**
  - Offline IEEE OUI Trie resolver (`app/core/oui_resolver.py`) with RFC 7042 LAA detection.
  - Anti-SSRF URL validator & IP pinning transport (`app/core/security_webhook.py`).
  - Bcrypt password hashing and JWT encoding/decoding (`app/core/user_auth.py`).
  - PostgreSQL Row-Level Security tenant setter (`app/core/database.py`).
- **REST & MCP Routers:**
  - `/api/v1/auth`: Login, register, me profile.
  - `/api/v1/devices`: Inventory, detail, patch, bulk updates.
  - `/api/v1/discovery`: Collector observation ingest & candidate promotion.
  - `/api/v1/monitoring`: Synthetic probe targets and manual check trigger.
  - `/api/v1/presence`: Live summary and 24h hourly presence heatmap.
  - `/api/v1/notifications`: Alert policies, active incidents, Apprise test notification.
  - `/api/v1/integrations`: SDN and DNS sinkhole clients (UniFi, Omada, Pi-hole, AdGuard).
  - `/api/v1/diagnostics`: Ping, TCP port scan, Wake-on-LAN magic packet, Traceroute.
  - `/api/v1/mcp`: Anthropic Model Context Protocol JSON-RPC 2.0 interface.
  - `/api/v1/system`: Health check and system capability info.
- **Automated Test Coverage:**
  - `services/api/tests/`: 12 unit/integration tests passing (OUI, SSRF, Auth, WOL, Presence, Diagnostics, MCP).

### 2.2 Go Discovery Collector (`services/collector`)
- **Runtime:** Pure Go 1.22 daemon (zero CGo dependencies).
- **Discovery Subsystems:**
  - Subnet IP generation (`sweep.go`).
  - Token-bucket rate limiter (`rate_limiter.go`) to prevent switch MAC flooding.
  - Wake-on-LAN magic packet generator (`wol.go`).
  - TCP connect ping probe (`ping.go`).
  - Local resilient queue buffer (`buffer.go`).
  - API batch ingest reporting client (`client.go`).
  - mDNS listener (`mdns.go`).
  - NetBIOS node status query on UDP 137 (`netbios.go`).
  - Rogue DHCP detector on UDP 67/68 (`dhcp_probe.go`).
  - SNMP ARP table stub poller (`snmp.go`).
- **Automated Test Coverage:**
  - `services/collector/internal/discovery/`: 3 tests passing.
  - `services/collector/internal/buffer/`: 1 test passing.
  - Binary compilation: verified clean with `go build`.

### 2.3 Web Console (`apps/web`)
- **Framework:** Next.js 14, React 18, Tailwind CSS, Lucide icons.
- **Views & Routes:**
  - Dashboard (`/`): Operations metrics, 24h fleet heatmap, recent alert stream.
  - Device Inventory (`/devices`): Search, status pills, table, interactive actions.
  - Presence Matrix (`/presence`): 24h hourly activity cards.
  - Topology Canvas (`/topology`): Infrastructure gateway, switch, and AP relationships.
  - Diagnostics (`/diagnostics`): Workbench for Ping, Port Scan, and Traceroute.
  - Integrations (`/integrations`): Hub for SDN and DNS sinkhole sync.
- **Build Status:** Next.js production build (`npm run build`) succeeded with 0 type errors; 9/9 routes prerendered.

### 2.4 Infrastructure (`infrastructure`)
- **Docker Compose:** Multi-service definition (`watchnet-postgres`, `watchnet-redis`, `watchnet-api`, `watchnet-collector`, `watchnet-web`, `watchnet-proxy`).
- **Caddyfile:** Alpine Caddy 2 reverse proxy with strict security headers, reverse proxying `/api/*` to API and `/*` to Web.
- **Database Init:** `init-db.sql` with PostgreSQL `pgcrypto` and `uuid-ossp`.

---

## 3. Reality vs. Claim Gap Identification

While the unit tests and frontend compilation have passed, the following critical gaps must be addressed:

1. **Docker Runtime Verification:** The stack has not yet been started and validated in a live Docker environment in this programme.
2. **Real Chrome UI Interaction:** Pages have been prerendered by Next.js, but real browser interaction (clicking buttons, submitting forms, verifying API calls, checking browser console logs for runtime JavaScript exceptions) must be executed.
3. **Database Seed Data:** A clean PostgreSQL database needs a default organization, admin user, and sample devices for realistic testing.
4. **End-to-End Collector to API Pipe:** Collector must run in an isolated test network and successfully deliver discovery batches to the live API container.
5. **Real RLS Enforcement:** Row-Level Security has been modeled, but must be verified by connecting as the unprivileged `watchnet_app` database user and attempting cross-tenant access.
6. **Notification Delivery Verification:** Apprise notifications must be tested with simulated/local endpoints to verify the full delivery pipeline.
7. **Backup and Restore:** Backup scripts must execute a real dump, drop, restore, and verify record parity.

