# WatchNet v1.0.0-rc.1 — Staging Burn-in Service Health Check Procedures

**Document Identifier:** `WNET-DOC-BURNIN-HLTH-001`  
**Version:** 1.0.0-rc.1  
**Status:** SPECIFICATION / TEST HARNESS READY  
**Monitored Services:** Backend API, Go Collector, PostgreSQL, Redis, Caddy Reverse Proxy  

---

## 1. Overview & Health Architecture

The WatchNet service health check framework provides multi-level health verification across all deployed containers and services during staging burn-in.

Health checks operate across two tiers:
1. **Liveness Probes:** Verify that the process is executing and responding to basic ping/socket requests without deadlocking.
2. **Readiness Probes:** Verify that all downstream dependencies (database connection pools, cache stores, broker message queues, raw socket listeners) are fully initialized and capable of servicing transactions.

---

## 2. Health Endpoint Definitions & Verification Standards

### 2.1 Backend Core API (`watchnet-backend`)
- **HTTP Endpoint:** `GET http://127.0.0.1:8000/api/v1/health`
- **Expected Status Code:** `200 OK`
- **Response Payload:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-11-13T13:45:00Z",
    "version": "1.0.0-rc.1",
    "components": {
      "database": "connected",
      "redis_cache": "connected",
      "event_broker": "active",
      "plugin_engine": "ready"
    }
  }
  ```
- **Failure Threshold:** 3 consecutive non-200 responses or timeout $> 2.0\text{s}$ triggers service warning.

### 2.2 Go Network Collector (`watchnet-collector`)
- **Unix Domain Socket:** `/run/watchnet/collector.sock` (or internal TCP `9090/healthz`)
- **Checks:**
  - Raw socket binding status (`AF_PACKET` / `pcap`).
  - Active sweep ticker state.
  - Inter-process communication link to backend.
- **Expected Status:** `200 OK`, `{"status":"ok","interface":"eth0","raw_sockets":true}`.

### 2.3 PostgreSQL Database (`watchnet-postgres`)
- **Mechanism:** `pg_isready -h 127.0.0.1 -p 5432 -U watchnet`
- **Expected Result:** `127.0.0.1:5432 - accepting connections`
- **Internal Query Probe:** `SELECT 1;` latency $< 5\text{ms}$.

### 2.4 Redis Cache & Broker (`watchnet-redis`)
- **Mechanism:** `redis-cli ping`
- **Expected Result:** `PONG`
- **Max Memory Check:** Used memory within 256 MB LRU boundary.

### 2.5 Caddy Reverse Proxy (`watchnet-caddy`)
- **HTTP Endpoint:** `GET http://127.0.0.1:2019/metrics` (Admin API) / `GET https://localhost/health`
- **Expected Result:** TLS handshake valid, backend proxy upstream online.

---

## 3. Automated Health Daemon Implementation

During the 72-hour burn-in, the following health daemon executes every 10 seconds:

```bash
#!/usr/bin/env bash
# WatchNet Health Prober
set -euo pipefail

LOG_FILE="/var/log/watchnet/burnin/service_health.log"

probe_service() {
    local name="$1"
    local cmd="$2"
    if eval "$cmd" > /dev/null 2>&1; then
        echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [HEALTH_OK] Service ${name} is healthy" >> "$LOG_FILE"
    else
        echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') [HEALTH_FAIL] Service ${name} FAILED probe!" >> "$LOG_FILE"
        exit 1
    fi
}

probe_service "backend" "curl -sf http://127.0.0.1:8000/api/v1/health"
probe_service "collector" "curl -sf http://127.0.0.1:9090/healthz"
probe_service "postgres" "docker compose exec -T watchnet-postgres pg_isready"
probe_service "redis" "docker compose exec -T watchnet-redis redis-cli ping"
probe_service "caddy" "curl -k -sf https://127.0.0.1/health"
```

---

## 4. Degradation Recovery Actions

If a service degrades during burn-in:
1. **Transient Timeout ($< 10\text{s}$):** Retry automatically with exponential backoff.
2. **Persistent Readiness Failure ($> 30\text{s}$):** Record formal incident in `BURN_IN_INCIDENT_REGISTER.md`.
3. **Hard Process Crash:** Container restart policy `restart: unless-stopped` captures core dump and restarts service. Restart counter increments and triggers incident audit.

---

## 5. Physical Gate Status

- **Status:** Test automation and container health checks verified.
- **Physical Appliance Execution:** **BLOCKED** pending bare-metal Linux hardware deployment.
