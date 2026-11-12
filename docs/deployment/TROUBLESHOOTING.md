# WatchNet Troubleshooting Guide

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Applicability:** Production Operations, Diagnostic Runbooks, Error Codes  

---

## 1. Quick Diagnostic Triage

When diagnosing issues with WatchNet, start by inspecting the health of the containerized stack:

```bash
# 1. Inspect running container status
docker compose ps

# 2. Inspect real-time consolidated logs with timestamps
docker compose logs -f --tail=100

# 3. Check API health endpoint directly
curl -i http://localhost:8000/api/health
```

---

## 2. Common Issues & Resolution Runbooks

### 2.1 Issue: Devices Not Appearing in UI (Discovery Ingest Failure)
- **Symptom:** The web dashboard displays 0 devices despite active network traffic.
- **Root Causes & Solutions:**
  1. *Collector Container Network Mode:* Ensure `watchnet-collector` runs with `network_mode: host` in `docker-compose.yml`. Standard bridge networks isolate the container from LAN ARP broadcasts.
  2. *Missing Linux Capabilities:* Ensure `CAP_NET_RAW` is granted to the collector container. Check collector logs: `docker compose logs collector | grep "permission denied"`.
  3. *Collector Ingest Signature Mismatch:* If `COLLECTOR_SECRET_KEY` does not match `API_SECRET_KEY`, the API rejects batches with `401 Unauthorized`. Check API logs for signature verification failures.

### 2.2 Issue: Database Migration (Alembic) Lock Contention
- **Symptom:** `alembic upgrade head` hangs indefinitely during startup.
- **Root Cause:** An existing connection has acquired an exclusive lock on a table.
- **Resolution:**
  ```sql
  -- Run inside PostgreSQL console (docker compose exec db psql -U watchnet)
  SELECT pid, query, state, age(clock_timestamp(), query_start) 
  FROM pg_stat_activity 
  WHERE state != 'idle' AND query ILIKE 'ALTER TABLE%';
  -- Terminate blocking process
  SELECT pg_terminate_backend(blocking_pid);
  ```

### 2.3 Issue: Parental DNS Blocking Ineffective on Specific Clients
- **Symptom:** Child device can still access blocked domains (e.g., YouTube) despite bedtime policy being active.
- **Root Causes & Solutions:**
  1. *DoH / iCloud Private Relay:* iOS devices with "Private Wi-Fi Address" or "iCloud Private Relay" bypass local DNS servers. Resolution: Block TCP/UDP port 853 and disable iCloud Private Relay on the managed device.
  2. *Secondary DNS Configured:* The device's DHCP lease or manual network settings may point to a secondary public DNS (e.g. `8.8.8.8`). Ensure the router distributes **only** the WatchNet/AdGuard IP via DHCP Option 6.

### 2.4 Issue: High CPU Usage on Small Host (Raspberry Pi)
- **Symptom:** Host load average spikes above core count.
- **Resolution:**
  - Increase `DISCOVERY_SWEEP_INTERVAL_SECONDS` from 30s to 120s.
  - Disable heavy Nmap service version detection (`ENABLE_DEEP_PORT_SCAN=false`).
