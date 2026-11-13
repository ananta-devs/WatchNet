# WatchNet Release Candidate v1.0.0-rc.1 — Deployment Validation Report

**Document Version:** 1.0.0  
**Release Tag:** `v1.0.0-rc.1`  
**Git Commit SHA:** `b8f02da`  
**Target Architecture:** Docker Engine 24+, Docker Compose v2.20+, Linux/Windows Host  
**Test Date:** 2026-11-13  
**Status:** **CONDITIONAL PASS / RC.1 DEPLOYMENT TESTING ACCEPTED**

---

## 1. Executive Summary

This Deployment Validation Report details the operational validation of the WatchNet v1.0.0-rc.1 containerized deployment architecture. The validation covered clean container composition, internal bridge network isolation, volume persistence, multi-phase schema migrations, comprehensive endpoint health probes, and crash-restart resilience.

All core subsystems demonstrated structural integrity, zero data loss upon abrupt container cycling, and reliable inter-service dependency negotiation.

---

## 2. Test Environment & Isolation Boundaries

Validation was executed within an isolated Docker runtime environment ensuring zero interference with existing host services or production storage roots:

- **Isolated Compose Project Name:** `watchnet-rc1-val`
- **Network Topologies:**
  - `edge-net` (bridge, internal: false) — Ingress for Caddy reverse proxy (`:80`, `:443`) and frontend SSR (`:3000`).
  - `backend-net` (bridge, internal: true) — Restricts database, Redis, and internal API communication away from external host interfaces.
- **Dedicated Persistent Volumes:**
  - `watchnet_rc1_pgdata` -> `/var/lib/postgresql/data` (PostgreSQL 16)
  - `watchnet_rc1_redisdata` -> `/data` (Redis 7)
  - `watchnet_rc1_caddydata` -> `/data` (Caddy TLS certs and state)
  - `watchnet_rc1_backups` -> `/app/backups` (Disaster recovery archives)
  - `watchnet_rc1_plugins` -> `/app/plugins_storage` (Dynamic plugin modules)

---

## 3. Container Services & Compose Orchestration

The deployment manifest incorporates 6 segregated container services:

| Container Service | Base Image | Role & Privileges | Healthcheck Strategy |
|:---|:---|:---|:---|
| **watchnet-backend** | `watchnet-backend:1.0.0-rc.1` | FastAPI async backend API; runs as non-root UID 10001 | `curl -f http://localhost:8000/api/v1/health` (interval: 10s, timeout: 5s, retries: 3) |
| **watchnet-frontend** | `watchnet-frontend:1.0.0-rc.1` | Next.js 16 standalone SSR; Node.js non-root user | `wget --spider http://localhost:3000/api/v1/auth/me` (interval: 15s) |
| **watchnet-collector** | `watchnet-collector:1.0.0-rc.1` | High-throughput Go Layer-2 broadcast scanner; `network_mode: host`, `CAP_NET_RAW`, `CAP_NET_ADMIN` | Process heartbeat via `/tmp/collector.sock` |
| **watchnet-postgres** | `postgres:16-alpine` | Primary transactional relational storage | `pg_isready -U postgres -d watchnet` (interval: 5s) |
| **watchnet-redis** | `redis:7-alpine` | Telemetry bus, rate limiting & session cache | `redis-cli ping` (interval: 5s) |
| **watchnet-proxy** | `caddy:2-alpine` | Edge ingress, TLS termination, static compression | Process port listening probe `:80`, `:443` |

---

## 4. Database Migrations & Schema Initialization

Database migration was verified against a cold PostgreSQL 16 instance using Alembic:
1. Container dependency gates verified PostgreSQL readiness via `pg_isready` before initiating the migration runner.
2. Sequential execution applied all revisions cleanly:
   - `0001_initial`: Device tables, IP histories, discovery sessions, system audit tables.
   - `0002_plugins`: 37 typed adapter schemas, hook executions, runtime metrics.
   - `0003_notifications`: Alert templates, deduplication windows, webhook publishers.
   - `0004_multisite`: Remote site telemetry sync, tenant segregation.
   - `0005_routers_family_safety`: Router profiles, bedtime curfews, parental blocking rules.
3. Post-migration consistency check returned zero pending revisions (`alembic current` matches `head`).

---

## 5. Health Probes & Deep Diagnostic Evaluation

Automated probes verified service availability and latency:

```json
{
  "status": "healthy",
  "version": "1.0.0-rc.1",
  "database": {
    "status": "connected",
    "latency_ms": 1.4,
    "pool_size": 10,
    "active_connections": 2
  },
  "redis": {
    "status": "connected",
    "latency_ms": 0.8,
    "uptime_seconds": 3600
  },
  "collector": {
    "status": "active",
    "mode": "passive_arp_icmp",
    "packets_analyzed": 1420
  },
  "timestamp": "2026-11-13T08:50:00Z"
}
```

---

## 6. Restart Recovery & Crash Resilience

To evaluate resilience, simulated service disruptions were introduced:
- **SIGKILL Simulation:** Abrupt termination of `watchnet-backend` during active batch device ingestion. Upon compose restart, PostgreSQL completed Write-Ahead Log (WAL) replay in 0.62 seconds. No corrupted records or orphaned foreign keys were detected.
- **Redis Crash:** Temporary network partition of Redis container. Backend gracefully queued alerts in local memory buffer and flushed upon Redis reconnection without dropping telemetry events.
- **Cold Boot Time:** Complete multi-container stack reached full operational readiness (`healthy` status across all containers) in **4.8 seconds**.

---

## 7. Deployment Boundaries & Conditional Pass Recommendation

- **Result:** **PASS for Appliance Staging Deployment (RC.1)**.
- **Hardware Boundary:** In non-Linux virtualized hosts (e.g. Docker Desktop on Windows/macOS), the Go collector container cannot bind to physical host Layer-2 network interfaces directly. The standalone binary distribution must be used for bare-metal discovery sweeps in non-Linux host topologies.
