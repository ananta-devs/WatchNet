# Architecture Decision Records (ADRs)

## ADR-001: Replacement of PHP Web Layer with Next.js 14 & TypeScript
* **Status:** Accepted
* **Context:** Legacy Upstream employs a legacy PHP 8 front-end combined with vanilla jQuery and procedural PHP scripts (`front/php/*.php`). This created process boundary issues, lacked end-to-end type safety, and incurred high overhead in Docker containers.
* **Decision:** Replace PHP completely with a Next.js 14 App Router application written in TypeScript, styled with Tailwind CSS, and powered by React Server Components and Lucide icons.
* **Consequences:** Eliminates PHP from the runtime entirely. Provides modern single-page-app ergonomics, server-side rendering for speed, strict compile-time type validation, and direct WebSocket/SSE integration.

---

## ADR-002: Transition from SQLite to Multi-Tenant PostgreSQL 16 with Row-Level Security (RLS)
* **Status:** Accepted
* **Context:** Legacy Upstream stored all application and scan state in a single SQLite file (`app.db`). Under high network discovery loads, concurrent SQLite writes resulted in transaction locks (`database is locked`) and prevented true multi-tenant deployment.
* **Decision:** Adopt PostgreSQL 16 with native multi-tenant isolation enforced via PostgreSQL Row-Level Security (RLS). All application tables carry a `tenant_id` column, and session variables (`app.current_tenant_id`) partition data access at the database kernel level. Dedicated unprivileged application user `watchnet_app` interacts with the database.
* **Consequences:** Eliminates lock contention; enables horizontal scaling, ACID transactional guarantees, JSONB semi-structured storage, and enterprise-grade backup/recovery via `pg_dump` and `pg_restore`.

---

## ADR-003: Clean-Room Decoupled Collector Architecture in Go
* **Status:** Accepted
* **Context:** Upstream scanning relied on synchronous Python scripts shelling out to CLI binaries (`arp-scan`, `fping`, `nmap`) inside the web server process.
* **Decision:** Decouple scanning into an independent lightweight Go daemon (`services/collector`). The collector interfaces directly with raw sockets and libpcap, performs concurrent Layer-2 and Layer-3 discovery, buffers observations locally, and streams observations via HTTPS POST / mTLS back to the central API service.
* **Consequences:** The main API server never executes privileged network operations or shell binaries. The collector can run as a remote satellite agent across multiple VLANs or edge locations.

---

## ADR-004: Anti-SSRF and Network Egress Security Hardening
* **Status:** Accepted
* **Context:** Integrations (UniFi, Pi-hole, webhooks, AdGuard) allow users to input target IP addresses and URLs. Without strict egress validation, this creates Server-Side Request Forgery (SSRF) vulnerabilities targeting internal cloud metadata services (e.g. `169.254.169.254`) or loopback services (`127.0.0.1`).
* **Decision:** Implement strict egress guardrails in Python HTTP clients. Resolve DNS hostnames before requests and reject all private/loopback/cloud-metadata IP ranges unless explicitly whitelisted for local router integration targets.
* **Consequences:** Prevents SSRF exploitation while preserving router and local DNS server connectivity.

---

## ADR-005: Clean-Room Plugin SDK & Adapter Pattern
* **Status:** Accepted
* **Context:** Upstream plugins directly manipulated global SQLite tables and executed arbitrary Python scripts in-process.
* **Decision:** Formalize a plugin SDK utilizing the Adapter and Registry design patterns. Plugins execute as sandboxed worker tasks with well-defined input schemas, validated outputs, rate limiting, and structured error handling.
* **Consequences:** Upgrades to core services do not break plugin integrations. Plugin failures are gracefully captured as system events without crashing the scanning pipeline.
