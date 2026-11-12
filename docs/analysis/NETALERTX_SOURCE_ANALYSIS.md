# NetAlertX Source Code & Structural Analysis

**Document Version:** 1.0.0  
**Inspection Target:** D:\NetAlertX-main\NetAlertX-main  
**Reference Snapshot:** D:\NetAlertX-Reference-Snapshot  

---

## 1. Upstream Directory Structure Analysis

The upstream repository contains 1,393 files organized across several distinct tiers:
1. ront/: Legacy PHP 8 and JavaScript presentation tier.
   - Mixes server-rendered PHP templates (ront/php/templates/), vanilla jQuery logic (ront/js/), and third-party vendor assets (AdminLTE, DataTables, Chart.js).
   - Direct session queries and execution calls are embedded inside PHP files, creating tight coupling.
2. server/: Python backend and core execution loops.
   - server/api_server/: Flask REST API and GraphQL endpoints.
   - server/scan/: Core network discovery loops (scan.py), event calculation (events.py), and session intervals (sessions.py).
   - server/plugins/: 56 standalone plugin folders containing config.json, execution scripts (.py or .sh), and metadata.
   - server/db/: SQLite initialization schemas and dynamic upgrade scripts (db_upgrade.py).
3. config/: Application configuration templates and user setting definitions.
4. 	est/: Python unit tests and legacy Playwright E2E browser test specs.

---

## 2. Core Execution Loop Breakdown

The heart of NetAlertX is a sequential cron/systemd execution loop orchestrated by server/__main__.py:
1. **Initial Scan Cycle**: Spawns server/scan/scan.py to trigger ARP scans, ICMP sweeps, and IP-neighbour table lookups.
2. **CurrentScan Staging**: Scan results are bulk-written to a temporary SQLite table (CurrentScan).
3. **Diff Calculation**: Python logic executes SQL queries comparing CurrentScan with the persistent Devices table to identify new devices, changed IPs, or offline devices.
4. **Event Insertion**: State transitions are written into the Events table.
5. **Session Resolution**: Connected durations are computed and updated in the Sessions table.
6. **Plugin Invocation**: The scheduler iterates through enabled plugins sequentially, executing external processes and collecting output.
7. **Notification Processing**: Queued alerts are dispatched via configured publisher scripts.

---

## 3. Structural Deficiencies & Technical Debt

1. **Tight Coupling of Monolithic Loop**: A failure in one scanner (e.g., nmap hanging or router SSH timing out) blocks the entire execution cycle, delaying device discovery across the whole network.
2. **SQLite Concurrency Bottleneck**: Concurrently reading the web dashboard while a scan loop writes batches of 200 devices triggers sqlite3.OperationalError: database is locked.
3. **Execution Privilege Exposure**: Python scripts require root permissions to execute low-level network tools (rp-scan, ping, raw socket binding), running the entire web server and API under root privileges.
