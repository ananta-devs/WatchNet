# WatchNet v1.0.0-rc.1 — Staging Burn-in Resource Utilization & Leak Detection Benchmarks

**Document Identifier:** `WNET-DOC-BURNIN-RES-001`  
**Version:** 1.0.0-rc.1  
**Status:** BENCHMARK SPECIFICATION & LEAK AUDIT CRITERIA  
**Measurement Cadence:** 30-Second Snapshots Over 72 Continuous Hours  

---

## 1. Overview & Resource Budgets

To ensure appliance stability in embedded and edge environments (such as a Raspberry Pi or mini PC running 24/7), WatchNet enforces strict resource consumption budgets. Memory leaks, goroutine leaks, database handle accumulation, and CPU thrashing during continuous subnet discovery are treated as release-blocking defects.

### Table of Allocated Resource Budgets

| Service Component | Target RSS (Idle) | Peak RSS (Discovery Burst) | Maximum Permitted RSS | Max Leak Slope (Post 12h) | Max CPU Core % |
|:---|:---:|:---:|:---:|:---:|:---:|
| `watchnet-backend` (FastAPI) | 120 MB | 220 MB | 350 MB | $< 5.0\text{ KB/hour}$ | $< 15\%$ (1 core) |
| `watchnet-collector` (Go) | 25 MB | 45 MB | 65 MB | $0.0\text{ KB/hour}$ (Zero leak) | $< 10\%$ (1 core) |
| `watchnet-postgres` (16) | 60 MB | 140 MB | 256 MB | N/A (cgroup bounded) | $< 10\%$ (1 core) |
| `watchnet-redis` (7.2) | 15 MB | 35 MB | 64 MB | N/A (bounded cache) | $< 2\%$ (1 core) |
| `watchnet-caddy` | 18 MB | 30 MB | 50 MB | $0.0\text{ KB/hour}$ | $< 5\%$ (1 core) |
| **Entire Appliance Stack** | **~238 MB** | **~470 MB** | **785 MB** | **Flatline** | **$< 42\%$ (Combined)** |

---

## 2. Leak Detection Methodology & Linear Regression Criteria

During the 72-hour burn-in, memory utilization is sampled every 30 seconds (8,640 total observations). Memory leak detection follows a two-phase analysis:

### Phase 1: Initial Warm-Up Window (Hours 0 – 12)
During the first 12 hours, memory expansion is expected due to:
- JIT compilation, Python module loading, and dynamic type cache allocation.
- SQLAlchemy connection pool expansion up to max pool size (20 connections).
- IEEE MAC OUI database in-memory trie population (~18 MB).
- Initial subnet device discovery caching.

### Phase 2: Steady-State Leak Analysis Window (Hours 12 – 72)
Across the remaining 60 hours, the resident memory time series $M(t)$ is modeled via least-squares linear regression:
$$M(t) = \alpha + \beta t + \epsilon$$
Where:
- $t$ is elapsed time in hours.
- $\beta$ is the memory drift rate ($\text{KB/hour}$).
- $\epsilon$ is periodic cyclical variance (caused by garbage collection cycles).

### Acceptance Criteria:
- **FastAPI Backend:** $\beta \le 5.0\text{ KB/hour}$ (indicating standard interpreter fragmentation without unreferenced object retention).
- **Go Collector:** $\beta \le 0.5\text{ KB/hour}$; Goroutine count variance $\sigma_{\text{goroutines}} < 2.0$.
- **Postgres / Redis:** Total database disk growth $\le 15\text{ MB/day}$ for 100 tracked devices with 30-day telemetry retention.

---

## 3. Automated Leak Profiling Harness

When staging hardware is online, memory snapshots are taken using `tracemalloc` for Python and `pprof` for Go:

```bash
# Python Backend tracemalloc snapshot
curl -s http://127.0.0.1:8000/api/v1/debug/memory-snapshot -o /var/log/watchnet/burnin/backend_mem_$(date +%s).json

# Go Collector heap profile
go tool pprof -http=:6060 http://127.0.0.1:9090/debug/pprof/heap
```

Any leak exceeding the allocated budget immediately halts the burn-in run under code `ERR_LEAK_01`.

---

## 4. Physical Gate Audit Result

- **Containerized Memory Profiling:** Verified in local docker runs; idle RSS baseline conforms to 240 MB stack footprint.
- **72-Hour Continuous Hardware Leak Qualification:** **BLOCKED** pending bare-metal Linux appliance provisioning.
