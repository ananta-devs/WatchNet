# WatchNet System Architecture & Component Specifications

**Document Version:** 1.0.0  
**Phase:** Phase 1 Target Reference  

---

## 1. System Component Overview

WatchNet is engineered as a decoupled, microservices-capable platform structured into distinct functional tiers:

```
+-------------------------------------------------------------------------------+
|                                  USER BROWSER                                 |
+-------------------------------------------------------------------------------+
                                        | (HTTPS / WSS)
                                        v
+-------------------------------------------------------------------------------+
|                       EDGE REVERSE PROXY & GATEWAY (Caddy)                    |
+-------------------------------------------------------------------------------+
                 |                                              |
      (Frontend HTTP Requests)                       (API Calls & WebSockets)
                 v                                              v
+--------------------------------+             +--------------------------------+
|        WEB APPLICATION         |             |       CORE API BACKEND         |
|        (Next.js 14 RSC)        |             |       (FastAPI / Python)       |
|  - TypeScript / React 18       |             |  - OpenAPI 3.1 REST Endpoints  |
|  - Tailwind CSS & Radix UI     |             |  - JWT / RBAC Authentication   |
|  - React Flow Topology Engine  |             |  - Multi-Tenant RLS Manager    |
|  - Realtime SSE / WSS Client   |             |  - Anti-SSRF Egress Proxy      |
+--------------------------------+             +--------------------------------+
                                                                |
                                        +-----------------------+-----------------------+
                                        |                       |                       |
                                        v                       v                       v
                         +--------------------+  +--------------------+  +--------------------+
                         |  POSTGRESQL 16 RLS |  |   REDIS 7 BROKER   |  |   CELERY WORKER    |
                         |  - Device Registry |  |  - Task Queue      |  |  - Plugin Adapters |
                         |  - Session Ledger  |  |  - SSE / WSS PubSub|  |  - Router Polling  |
                         |  - Multi-Tenant RLS|  |  - Ephemeral State |  |  - Alerts & Notifs |
                         |  - Partitioned Logs|  |                    |  |  - Workflow Engine |
                         +--------------------+  +--------------------+  +--------------------+
                                                                                    ^
                                                                                    | (mTLS / REST)
                                                                                    |
                                                                         +--------------------+
                                                                         | WATCHNET COLLECTOR |
                                                                         | (Go Daemon)        |
                                                                         |  - Raw Socket ARP  |
                                                                         |  - ICMP Probing    |
                                                                         |  - mDNS Snooping   |
                                                                         |  - Local Buffering |
                                                                         +--------------------+
```

---

## 2. Component Specifications

### 2.1 Web Application (`apps/web`)
- **Framework:** Next.js 14 with App Router architecture.
- **Language:** TypeScript 5.x with strict type checking.
- **UI Components:** Tailwind CSS, Radix UI primitives, Lucide React icons.
- **Visualization:**
  - `React Flow` for network topology graphs with auto-layout.
  - Custom SVG calendar heatmap for device presence tracking.
  - Interactive diagnostics terminal and live execution consoles.

### 2.2 Core API Backend (`services/api`)
- **Framework:** FastAPI with Python 3.11+.
- **ORM / Database:** SQLAlchemy 2.0 async engine with Alembic migrations.
- **Security:**
  - Multi-tenant Row-Level Security (RLS) enforcement via database context switches (`SET LOCAL app.current_tenant_id`).
  - OAuth2 Password Bearer / JWT with cryptographic HMAC-SHA256 signing.
  - Egress anti-SSRF IP filtering module.

### 2.3 Distributed Network Collector (`services/collector`)
- **Language:** Go (Golang) compiled binary.
- **Capabilities:**
  - Non-blocking asynchronous Layer-2 ARP broadcast scanner.
  - Concurrent ICMP ping sweep engine.
  - Real-time Linux kernel netlink neighbor table watcher (`rtnetlink`).
  - Edge buffering with exponential backoff retry for network partition resilience.

### 2.4 Data & State Tier
- **Relational Store:** PostgreSQL 16.
  - Tenant data strictly segregated via PostgreSQL RLS policies.
  - Unprivileged user `watchnet_app` utilized for all runtime connections.
- **Message Broker & Cache:** Redis 7.
  - Celery asynchronous task distribution.
  - Pub/Sub channels for Server-Sent Events (SSE) and WebSocket broadcasts.
