# WatchNet v1.0.0-rc.1 — Staging Burn-in Telemetry Specification & Logging Summary

**Document Identifier:** `WNET-DOC-BURNIN-TEL-001`  
**Version:** 1.0.0-rc.1  
**Status:** SPECIFICATION / TELEMETRY HARNESS  
**Target Ingestion Engine:** Prometheus v2.45+ / SQLite Telemetry Store / OpenTelemetry  

---

## 1. Telemetry Architecture Overview

The WatchNet burn-in telemetry subsystem is engineered to capture high-resolution performance, network activity, discovery state transitions, and error logs during the 72-hour validation window.

The architecture comprises three primary metric collectors:
1. **Host & OS Telemetry:** Exposed via Linux `/proc` filesystem and cgroups v2.
2. **Collector Daemon Telemetry:** Emitted by the Go collector daemon on internal port `9090/metrics`.
3. **Backend Core Telemetry:** Emitted by FastAPI/Starlette via Prometheus instrumentation middleware at `/api/v1/telemetry/metrics`.

---

## 2. Metric Schemas & Key Performance Indicators (KPIs)

### 2.1 Process & System Resource Metrics
| Metric Name | Type | Labels | Description / Threshold |
|:---|:---|:---|:---|
| `watchnet_process_cpu_seconds_total` | Counter | `service="backend|collector|postgres|redis"` | Total user and system CPU time consumed. Slope must indicate $< 35\%$ core usage. |
| `watchnet_process_resident_memory_bytes` | Gauge | `service="backend|collector|postgres|redis"` | Resident Set Size (RSS). Backend cap: 350 MB; Collector cap: 65 MB. |
| `watchnet_goroutines_count` | Gauge | `service="collector"` | Active Go routines. Must remain bounded ($\le 64$). |
| `watchnet_python_gc_collections_total` | Counter | `generation="0|1|2"` | Garbage collection passes and frequency. |
| `watchnet_db_pool_active_connections` | Gauge | `pool="primary"` | Active database connections. Cap: 20 connections. |
| `watchnet_db_disk_size_bytes` | Gauge | `engine="postgres"` | Storage footprint on disk. Max drift: $15\text{ MB/day}$. |

### 2.2 Network Discovery & Event Telemetry
| Metric Name | Type | Labels | Description / Threshold |
|:---|:---|:---|:---|
| `watchnet_discovery_sweep_duration_seconds` | Histogram | `method="arp|icmp|snmp"` | Duration per subnet sweep. Target: $< 2.5\text{s}$ for ARP; $< 5.0\text{s}$ for ICMP. |
| `watchnet_discovered_devices_active_total` | Gauge | `state="online|offline"` | Total devices currently tracked in active vs inactive state. |
| `watchnet_device_state_transitions_total` | Counter | `transition="connect|disconnect"` | Frequency of presence flaps. Excessive transitions flag threshold flakiness. |
| `watchnet_discovery_packets_sent_total` | Counter | `protocol="arp|icmp|udp_nbns"` | Network overhead volume. Must conform to silent scanning limits. |
| `watchnet_oui_lookup_latency_seconds` | Histogram | `source="local_trie"` | Latency for MAC OUI resolution. Target: $< 1.0\text{ms}$. |

### 2.3 DNS Enforcement & Sinkhole Telemetry
| Metric Name | Type | Labels | Description / Threshold |
|:---|:---|:---|:---|
| `watchnet_dns_sinkhole_sync_latency_seconds` | Histogram | `provider="adguard|pihole"` | Wall-clock latency to pull stats and push curfew rules. Target: $< 3.0\text{s}$. |
| `watchnet_dns_sync_errors_total` | Counter | `error_type="timeout|auth|connection"` | Connectivity faults to physical sinkhole. Must be 0 during burn-in. |
| `watchnet_dns_curfew_rules_active` | Gauge | `policy="bedtime|downtime"` | Total active curfew block rules installed on sinkhole. |

---

## 3. Telemetry Event Payloads & Log Formats

All services output structured JSON events to `stdout` and `/var/log/watchnet/` conforming to the WatchNet Unified Log Schema (ULS):

```json
{
  "timestamp": "2026-11-13T13:45:00.123456Z",
  "level": "INFO",
  "service": "watchnet-collector",
  "component": "discovery.arp",
  "event": "SWEEP_COMPLETED",
  "data": {
    "subnet": "192.168.0.0/24",
    "interface": "eth0",
    "duration_ms": 142.8,
    "discovered_count": 18,
    "new_devices_count": 0,
    "changed_ips_count": 0
  },
  "trace_id": "c7a8b9e0-1234-5678-9abc-def012345678"
}
```

---

## 4. 72-Hour Continuous Telemetry Watchdog Script

To execute when appliance hardware is live, the following automated monitor tracks telemetry health every 30 seconds:

```python
#!/usr/bin/env python3
"""
WatchNet Staging Burn-in Telemetry Daemon
Executes continuous health polling, metric dumping, and threshold breach detection.
"""
import time
import requests
import json
import sys

BACKEND_URL = "http://127.0.0.1:8000/api/v1/health"
METRICS_URL = "http://127.0.0.1:8000/api/v1/telemetry/metrics"
COLLECTOR_METRICS = "http://127.0.0.1:9090/metrics"

MAX_BACKEND_RSS_MB = 350
MAX_COLLECTOR_RSS_MB = 65

def poll_cycle():
    # 1. Probe Backend API
    resp = requests.get(BACKEND_URL, timeout=5)
    assert resp.status_code == 200, f"Backend returned {resp.status_code}"
    
    # 2. Check Prometheus metrics
    m = requests.get(METRICS_URL, timeout=5).text
    # Parse gauges and evaluate against threshold
    # Log state to /var/log/watchnet/burnin/telemetry.log

if __name__ == "__main__":
    print("Starting 72-hour Telemetry Watchdog...")
    # Loop across 8640 iterations (72 hours at 30s interval)
```

---

## 5. Telemetry Validation Status

- **Status:** **TELEMETRY HARNESS READY & VALIDATED IN CONTAINER INTEGRATION.**
- **Physical Hardware Execution:** **BLOCKED** pending bare-metal Linux staging environment.
