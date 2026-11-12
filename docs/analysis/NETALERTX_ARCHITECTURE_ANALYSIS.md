# NetAlertX Architecture Analysis

**Document Version:** 1.0.0  
**Baseline Snapshot:** `D:\NetAlertX-Reference-Snapshot`  
**Reference Upstream:** NetAlertX v26.x  
**Target Platform:** WatchNet Rebuild  

---

## 1. System Architecture Overview

Upstream NetAlertX employs a multi-tier hybrid architecture characterized by:
1. **Frontend Presentation**: Server-side rendered PHP combined with vanilla JavaScript, jQuery, and AdminLTE components.
2. **Backend API**: Python Flask runtime exposing REST and GraphQL endpoints alongside Server-Sent Events (SSE) for log streaming.
3. **Execution Loop**: Chronological cron-based and sleep-loop execution pipeline that runs plugins sequentially or semi-concurrently.
4. **Data Persistence**: Local embedded SQLite database (`app.db`) accessed concurrently by PHP, Python API, and standalone plugin processes.

---

## 2. Component Deconstruction & Data Flow

```
[ Local Network / Subnet ]
          | (ARP, ICMP, DNS, DHCP, SNMP)
          v
[ Subprocess CLI Binaries ] (arp-scan, fping, nmap, avahi)
          ^
          | (os.system / subprocess.Popen)
[ Python Plugin Scripts ] (server/plugins/*)
          |
          v (Raw SQL queries / SQLite Locks)
[ SQLite Database: app.db ]
     ^                 ^
     | (sqlite3-php)   | (Flask / SQLAlchemy / Raw SQL)
[ PHP Frontend UI ]   [ Flask API Server ]
```

### 2.1 The Scan & Detection Pipeline
1. The execution manager initiates a scheduled scan cycle.
2. Discovery plugins (`arp_scan`, `icmp_scan`, `ipneigh`) execute external system binaries via subprocess.
3. Scan outputs are parsed and written directly into the `CurrentScan` staging table in SQLite.
4. The processing script compares `CurrentScan` against `Devices`:
   - New MAC addresses trigger a `New Device` event and populate initial metadata.
   - Known MACs update `devLastConnection` and trigger online/offline session transitions in `Sessions`.
5. Notification plugins poll `Notifications` or execute directly to send webhooks or push messages.

---

## 3. Structural Bottlenecks and Architectural Flaws

### 3.1 SQLite Concurrency and Contention
- SQLite's single-writer limitation frequently causes `database is locked` exceptions under heavy network discovery sweeps.
- WAL (Write-Ahead Logging) mitigates read contention but fails when multiple asynchronous workers attempt concurrent write operations.

### 3.2 Monolithic Privilege Model
- Network scanning tools (`arp-scan`, raw ping) require `root` or `CAP_NET_RAW` privileges.
- In NetAlertX, the entire web server, API, and plugin engine run under an elevated user inside the container, violating the principle of least privilege.

### 3.3 Synchronous External Subprocesses
- Relying on CLI wrappers creates process overhead, fragile string output parsing, and unpredictable execution latency.

---

## 4. Modern Architecture Transition (WatchNet)

WatchNet completely replaces this monolithic model with a clean decoupled microservice/worker topology:
- **`watchnet-collector`**: Lightweight Go daemon with `CAP_NET_RAW` for packet sniffing and discovery.
- **`watchnet-api`**: Asynchronous FastAPI service running under an unprivileged user.
- **`PostgreSQL 16`**: Concurrent, multi-tenant relational persistence with ACID transactions and TimescaleDB/partition support.
- **`Redis 7`**: Distributed stream buffer and pub/sub message broker decoupling collectors from storage.
- **`Next.js 14`**: Modern reactive web application with instant UI updates via WebSockets and SSE.
