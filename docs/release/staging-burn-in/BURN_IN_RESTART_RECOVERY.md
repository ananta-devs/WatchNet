# WatchNet v1.0.0-rc.1 — Staging Burn-in Controlled Restart & Recovery Procedures

**Document Identifier:** `WNET-DOC-BURNIN-REC-001`  
**Version:** 1.0.0-rc.1  
**Status:** SPECIFICATION / TEST PROTOCOL  
**Target Scenarios:** Clean Graceful Reboot, Power Loss Hard Crash, Network Interface Flap  

---

## 1. Overview & Recovery Objectives

A core requirement for network appliances is resilient, deterministic recovery from unexpected power outages, kernel panics, or planned software reboots without data corruption or operator intervention.

The Controlled Restart & Recovery test suite is executed at scheduled intervals during the 72-hour burn-in (specifically at **Hour 24**, **Hour 48**, and **Hour 71**).

---

## 2. Test Scenarios & Execution Matrix

### 2.1 Scenario 1: Scheduled Graceful Container Restart (Hour 24)
- **Objective:** Verify clean SIGTERM signal handling, graceful drain of HTTP requests, flush of in-flight discovery buffers, clean PostgreSQL disconnection, and resumption of background scanning.
- **Procedure:**
  ```bash
  docker compose -f docker-compose.prod.yml restart
  ```
- **Acceptance Criteria:**
  - Services shut down within standard 10s grace period.
  - Zero uncommitted transaction rollbacks in PostgreSQL logs.
  - Zero socket lock collision on collector re-bind (`SO_REUSEADDR` / `AF_PACKET`).
  - Total recovery time to full health $\le 15.0\text{ seconds}$.

### 2.2 Scenario 2: Sudden Power Cut / Host Hard Crash (Hour 48)
- **Objective:** Simulate sudden loss of AC power without clean shutdown.
- **Procedure:**
  ```bash
  # Simulate kernel panic / hard power loss
  echo b > /proc/sysrq-trigger
  ```
  *(Or execute `docker kill --signal=SIGKILL watchnet-backend watchnet-postgres` on staging VM)*.
- **Acceptance Criteria:**
  - Host reboots cleanly without disk filesystem corruption.
  - PostgreSQL recovers from WAL without manual repair (`zero-loss WAL replay`).
  - WatchNet state machine recovers last known device list from database.
  - Initial subnet sweep runs within 30 seconds of system boot.

### 2.3 Scenario 3: Physical Network Link Flap / Disconnect (Hour 71)
- **Objective:** Validate daemon behavior when physical Ethernet cable is unplugged or core switch restarts.
- **Procedure:**
  ```bash
  ip link set dev eth0 down && sleep 60 && ip link set dev eth0 up
  ```
- **Acceptance Criteria:**
  - Go Collector detects `NETLINK_DOWN` and pauses raw sweeps without crashing or throwing unhandled panic.
  - Collector enters exponential reconnection retry loop.
  - When link returns, collector immediately re-acquires interface handle and executes resynchronization sweep.
  - Zero phantom "all devices offline" notifications emitted during link downtime.

---

## 3. Recovery Verification Matrix

| Test ID | Scenario Description | Max Downtime Allowed | Data Loss Tolerance | Automated Status | Physical Hardware Status |
|:---|:---|:---:|:---:|:---:|:---:|
| `REC-01` | Graceful stack restart | 15 seconds | 0 records | Passed in test harness | Blocked at availability gate |
| `REC-02` | SIGKILL sudden crash | 30 seconds | In-flight sweep only | Passed in test harness | Blocked at availability gate |
| `REC-03` | Network cable disconnect | Instant backoff | 0 records | Passed in test harness | Blocked at availability gate |

---

## 4. Current Status

The restart and recovery procedures are documented and verified in containerized environments. Physical appliance execution remains **BLOCKED** pending bare-metal Linux hardware deployment.
