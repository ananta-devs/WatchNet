# WatchNet — Modern Network Intelligence, Monitoring & Parental Control Platform

**Version:** 1.0.0-rc.1
**Release Tag:** 1.0.0-rc.1  
**Upstream Project Reference:** NetAlertX (GPL-3.0)  
**Workspace:** `D:\WatchNet-Rebuild`  

---

## 1. Overview

WatchNet is an enterprise-grade, modern network intelligence, monitoring, and transparent family safety platform built from the ground up to succeed and completely replace NetAlertX. WatchNet delivers 100% feature parity with NetAlertX while replacing its legacy monolithic PHP/SQLite/cron-loop stack with a high-performance, modular, reactive microservice architecture.

WatchNet couples advanced layer-2 through layer-7 discovery engines with hardware-agnostic router integrations (supporting OpenWrt, AsusWRT, FRITZ!Box, MikroTik, UniFi, and enterprise gateways) and transparent, consent-based DNS policy orchestration (integrating AdGuard Home and Pi-hole).

---

## 2. Core Pillars & Architecture

1. **Complete NetAlertX Feature Parity**: Full support for all 56 upstream plugin capabilities, active/passive scans, multi-channel alerting, presence bitmap tracking, device session lifecycles, and customizable device metadata.
2. **Modern Technology Stack**:
   - **Frontend**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Table, Recharts, and Lucide icons.
   - **Backend API**: Python 3.12+ FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), Alembic, SSE (Server-Sent Events), and WebSockets.
   - **Collector Engine**: Modular Go network discovery collector utilizing raw sockets, ARP/NDP, ICMP, SNMP v2c/v3, and packet capture under least-privilege capability models (`CAP_NET_RAW`, `CAP_NET_ADMIN`).
   - **Data Layer**: PostgreSQL 16+ with partitioned event/session history, JSONB device attributes, and Redis 7+ for caching, real-time message brokering, and token revoking.
3. **Decoupled Parental Controls & Resilient Discovery**: Core network inventory and presence detection operate completely independently from DNS filtering engines. Failure of a downstream filtering DNS resolver never degrades core network monitoring.
4. **Hardware-Agnostic Router Architecture**: Abstract `BaseRouterAdapter` supporting ARP lease extraction, client isolation, static reservations, and live bandwidth polling without vendor lock-in.
5. **Multi-Site & Remote Probes**: Centralized WatchNet Hub orchestrating lightweight remote Go collectors across multiple remote LANs/VLANs via secure mutual TLS (mTLS).

---

## 3. Repository Structure

```
WatchNet-Rebuild/
├── apps/
│   └── web/                   # Next.js App Router Frontend
├── services/
│   ├── api/                   # FastAPI Backend Services & Relational Engine
│   └── collector/             # Go Network Discovery & Packet Daemon
├── packages/
│   └── shared-types/          # Shared TypeScript / JSON schema contracts
├── docs/                      # Comprehensive Documentation Foundation
│   ├── project/               # Project Scope, Parity Matrix, Roadmaps
│   ├── analysis/              # NetAlertX Upstream Technical Analyses
│   ├── architecture/          # ADRs, Architectural Specs & Mermaid Diagrams
│   ├── security/              # Threat Models, RBAC, Encryption, Privacy
│   ├── integrations/          # Routers, Pi-hole, AdGuard, Notification Specs
│   ├── testing/               # E2E Playwright, Unit, Integration & Manual Plans
│   └── deployment/            # Docker Compose, Production & Windows Guides
├── infrastructure/            # Docker, Compose, Traefik, PostgreSQL Configurations
├── scripts/                   # Migration, Verification & Tooling scripts
├── README.md                  # System overview
├── CHANGELOG.md               # Version release & iteration history
├── CONTRIBUTING.md            # Clean-room contribution guidelines
├── SECURITY.md                # Security vulnerability reporting & policies
├── LICENSE                    # GNU General Public License v3.0
├── NOTICE.md                  # Upstream attribution & third-party notices
├── ROADMAP.md                 # Strategic release roadmap
└── IMPLEMENTATION_STATUS.md   # Live phase execution tracker
```

---

## 4. Quick Start & Development

### Prerequisites
- Docker Engine 26+ and Docker Compose v2.27+
- Node.js 22 LTS & pnpm 9+
- Python 3.12+ & Go 1.23+
- Windows 11 / Linux host with admin privileges for raw socket testing

### Running via Docker Compose
```powershell
# Copy environment configuration
cp .env.example .env

# Launch database, Redis, API, and Web frontend
docker compose up -d --build
```
Navigate to `http://localhost:3000` to access the WatchNet interface. Swagger API documentation is accessible at `http://localhost:8000/docs`.

---

## 5. Licensing & Attribution

WatchNet is released under the **GNU General Public License v3.0 (GPL-3.0)**. It is a modern clean-room rebuild and functional replacement for [NetAlertX](https://github.com/netalertx/NetAlertX), preserving intellectual credit and attribution to the original NetAlertX authors and contributors while introducing an entirely novel codebase and modern architectural stack.
