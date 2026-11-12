# WatchNet Technical Roadmap & Implementation Sequences

## Phase 2 Recommended Execution Sequence

When Phase 2 authorization is granted, development should follow this sequential execution path:

1. **Sprint 2.1 — Database & State Tier Foundation:**
   - Initialize PostgreSQL 16 schema with Alembic migrations in `services/api`.
   - Apply Row-Level Security (RLS) policies and seed initial tenant/admin records.
   - Configure Redis 7 pub/sub infrastructure.

2. **Sprint 2.2 — Core API & Authentication Services:**
   - Implement FastAPI REST endpoints for Auth (JWT/Argon2id), Tenants, and Device management.
   - Integrate anti-SSRF client wrapper for all outgoing HTTP requests.
   - Set up WebSocket & SSE notification broadcasters.

3. **Sprint 2.3 — Go Network Discovery Daemon:**
   - Compile and configure `services/collector` for asynchronous ARP, ICMP, and netlink neighbor snooping.
   - Implement local disk buffering and HTTPS observation batch streaming.

4. **Sprint 2.4 — Next.js 14 Web Application:**
   - Construct responsive dashboard, device registry table, and drawer diagnostics in Next.js 14 / TypeScript.
   - Implement React Flow topology visualizer and presence heatmap component.

5. **Sprint 2.5 — Plugin Adapters & Router Integrations:**
   - Port core router adapters (UniFi, Omada, AsusWRT, OpenWrt, FritzBox) under the Read-Only Invariant.
   - Connect Pi-hole / AdGuard analytics widgets and Apprise/Email notification publishers.
