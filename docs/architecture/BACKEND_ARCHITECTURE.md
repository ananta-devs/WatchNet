# WatchNet Backend Architecture

**Document Version:** 1.0.0  
**Runtime:** Python 3.12 / FastAPI / SQLAlchemy 2.0 / Alembic / Pydantic v2  

---

## 1. Architecture Overview

The WatchNet backend is an asynchronous, high-concurrency application built on FastAPI. It completely eliminates legacy PHP and synchronous SQLite bottlenecks, implementing clean layered domain-driven design.

```
                    +---------------------------+
                    |    FastAPI Routing Layer   |
                    |   (OpenAPI, Auth, CORS)   |
                    +-------------+-------------+
                                  |
                    +-------------v-------------+
                    |    Service & Domain Layer |
                    |  (Device Manager, Policy) |
                    +-------------+-------------+
                                  |
         +------------------------+------------------------+
         |                                                 |
+--------v--------------+                 +----------------v--------------+
|  SQLAlchemy 2.0 ORM   |                 |    Integration Adapters       |
|  AsyncPG Repository   |                 |  (UniFi, RouterOS, DNS Sink)  |
+--------+--------------+                 +----------------+--------------+
         |                                                 |
+--------v--------------+                 +----------------v--------------+
|     PostgreSQL 16     |                 |   Outbound Anti-SSRF Proxy    |
+-----------------------+                 +-------------------------------+
```

---

## 2. Core Service Modules

1. **`api.v1.routers`**: Endpoints segmented by resource (`/devices`, `/events`, `/sessions`, `/integrations`, `/dns-policy`, `/users`, `/diagnostics`).
2. **`services.device_service`**: Device lifecycle reconciliation, deduplication by MAC address, vendor resolution, and IP change tracking.
3. **`services.session_service`**: Event correlation engine updating continuous connectivity intervals and calculating presence duration.
4. **`services.notification_service`**: Multi-channel notification router supporting templated alerts to Discord, Telegram, PushBullet, Webhooks, and Email.
5. **`adapters.router`**: Abstract interface implementations (`UniFiAdapter`, `OpenWrtAdapter`, `MikroTikAdapter`, `AsusWrtAdapter`) adhering to the Read-Only Invariant.
6. **`security.egress_guard`**: Strict egress HTTP client blocking connections to loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), and unauthorized RFC1918 addresses.

---

## 3. Real-Time Telemetry & Event Streaming

WatchNet provides Server-Sent Events (SSE) and WebSockets via FastAPI for instant frontend state updates:
- `/api/v1/stream/events`: Live feed of device connection, disconnection, and security alert events.
- `/api/v1/stream/telemetry`: CPU, memory, and collector packet rate telemetry streamed to the UI dashboard.
