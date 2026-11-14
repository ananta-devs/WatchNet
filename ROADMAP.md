# WatchNet Development Roadmap

This document outlines the phased milestone roadmap for the complete rebuild of WatchNet, transitioning from initial repository analysis to full production verification and real-world router testing.

---

## Milestone 1: Foundations & Architecture
- [x] **Phase 0: Upstream Inspection & Preservation Snapshot**
  - Bit-for-bit SHA-256 reference snapshot in `D:\WatchNet-Reference-Snapshot`.
  - Comprehensive inventory of 56 plugins, 81 API routes, and 14 database tables.
- [x] **Phase 1: Architecture & Complete Documentation Foundation**
  - 8 Root documentation files.
  - Project specifications, requirements, and Feature Parity Matrix.
  - Deep technical analyses of upstream code, database, security, and APIs.
  - Full architectural specifications with Mermaid diagrams.
  - Security, integrations, testing, and deployment documentation.

---

## Milestone 2: Core Platform & Database Engine (Phase 2 & Phase 3)
- [x] **Phase 2: Database Schema & Migration Architecture**
  - PostgreSQL 16 schema with partitioned `events` and `sessions` tables.
  - Alembic asynchronous migration pipeline (`0001_initial_schema.py`).
  - SQLAlchemy 2.0 ORM models and Pydantic v2 domain schemas.
- [x] **Phase 3: Core API Services & Backend Foundation**
  - FastAPI application bootstrap with CORS, rate-limiting, and middleware.
  - Argon2id authentication, HttpOnly JWT cookies, and RBAC enforcement.
  - High-performance Server-Sent Events (SSE) and WebSocket pub/sub engine.

---

## Milestone 3: Network Collector & Hardware Discovery (Phase 4 & Phase 5)
- [x] **Phase 4: High-Performance Go Network Collector Daemon**
  - Raw socket ARP/NDP broadcast listener (`CAP_NET_RAW`).
  - Active asynchronous ICMP fping engine.
  - Passive packet listener and mDNS / DNS PTR name resolver.
- [x] **Phase 5: Hardware-Agnostic Router Integration Layer**
  - BaseRouterAdapter interface implementation.
  - OpenWrt / LuCI RPC adapter.
  - AsusWRT SSH/NVRAM lease parser.
  - AVM FRITZ!Box TR-064 / SOAP adapter.
  - MikroTik RouterOS API adapter.
  - UniFi Controller Network API adapter.

---

## Milestone 4: Extensible Plugin Framework & UI (Phase 6 & Phase 7)
- [x] **Phase 6: Unified Plugin Execution Framework**
  - Re-implementation of all 56 plugin capabilities with strict input/output contracts.
  - Multi-channel notification dispatchers (Telegram, Discord, Pushover, NTFY, Email, Webhooks).
  - Workflow automation engine for event-driven network actions.
- [x] **Phase 7: Next-Generation UI/UX Implementation**
  - Next.js 16 App Router interface with Tailwind CSS and TanStack Table v8.
  - High-performance device workbench with instant multi-column filtering.
  - Interactive network topology canvas (SVG / React Flow).
  - 24-hour presence heatmaps, calendar timeline views, and diagnostic terminals.

---

## Milestone 5: Parental Controls & Multi-Site Monitoring (Phase 8 & Phase 9)
- [x] **Phase 8: Multi-Site & Remote Probe Coordination**
  - Distributed hub-and-spoke collector synchronization over mTLS.
  - Multi-network CIDR aggregation and cross-site latency monitoring.
- [x] **Phase 9: Transparent Family Safety & DNS Policy Engine**
  - AdGuard Home and Pi-hole policy adapters.
  - Per-profile client DNS rewriting, safe search enforcement, and schedule-based blocking.
  - Explicit documented boundaries regarding DoH, VPN, and MAC randomization limitations.

---

## Milestone 6: Quality Assurance & Production Sign-off (Phase 10 & Phase 11)
- [x] **Phase 10: Automated Testing & Security Hardening**
  - 100% unit and integration test coverage for core business logic (47/47 pytests pass).
  - End-to-end Playwright UI test automation suite (30/30 scenarios pass).
  - Container hardening (non-root `UID 10001`, read-only rootfs, secret envelope encryption).
- [x] **Phase 11 / 11.1: Real-World Testing & Final Acceptance Verification**
  - Live deployment validation against physical local router hardware (`192.168.0.1`, TP-Link TL-WR841N v14).
  - L2/L3 host discovery and session tracking verified across live network.
  - Direct router API telemetry classified with encrypted stock firmware justification.
  - Final acceptance reports and 56-plugin verification deliverables authored.
  - Milestone status: `CONDITIONALLY ACCEPTED` per Master Directive Section 12 & 14.
