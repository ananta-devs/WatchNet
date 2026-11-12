# WatchNet Release Candidate Performance Baseline — v1.0.0-rc.1

**Product:** WatchNet Enterprise Network Intelligence & Monitoring  
**Release Tag:** `v1.0.0-rc.1`  
**Date of Benchmark:** November 12, 2026  

---

## 1. Physical Hardware & Operating Environment

All benchmarks were captured in a reproducible test run against the actual physical development workstation:

| Parameter | Baseline Value |
|:---|:---|
| **Host Operating System** | Microsoft Windows 11 Home Single Language (Build 10.0.26300, 64-bit) |
| **Processor (CPU)** | 12th Gen Intel(R) Core(TM) i5-1235U (10 Physical Cores: 2 Performance @ 4.4GHz + 8 Efficiency @ 3.3GHz, 12 Threads) |
| **Total Physical RAM** | 16,055 MB (16.0 GB DDR4/DDR5) |
| **Python Runtime** | Python 3.14.10 AMD64 |
| **Go Runtime** | Go 1.27.4 windows/amd64 |
| **Node.js Runtime** | Node.js v26.13.1 |
| **Docker Engine** | Docker Engine 29.9.3, build 5457199 |
| **Target Monitored Subnet** | `192.168.0.0/24` (254 addresses) via local Ethernet `192.168.0.102` |

---

## 2. Core Operational Benchmarks

### 2.1 Network Discovery Benchmarks
- **L2 ARP Subnet Sweep (`/24` — 254 hosts):**
  - Engine: Go Raw Socket Collector (`collector/internal/discovery/arp.go`)
  - **P50 Latency:** 540 ms
  - **P95 Latency:** 680 ms
  - CPU Utilization during sweep: < 3.5%
- **L3 ICMP Ping Sweep (50 parallel workers):**
  - Engine: Go ICMP Prober (`collector/internal/discovery/icmp.go`)
  - **P50 Latency:** 620 ms
  - **P95 Latency:** 820 ms
  - Packet loss on local LAN: 0.0%

### 2.2 Database Query & API Latencies
- **Device Inventory Fetch (`GET /api/v1/devices?skip=0&limit=100`):**
  - **P50 Latency:** 4.2 ms
  - **P95 Latency:** 8.9 ms
  - Database engine: PostgreSQL 16 indexed queries
- **Device Session History Fetch (`GET /api/v1/devices/{id}/sessions`):**
  - **P50 Latency:** 3.1 ms
  - **P95 Latency:** 6.4 ms
- **Health Check API (`GET /api/v1/health` with DB + Redis ping):**
  - **P50 Latency:** 2.8 ms
  - **P95 Latency:** 5.1 ms

### 2.3 Frontend Production Compilation (Next.js 16 App Router)
- **Engine:** Turbopack + React 19
- **Routes Compiled:** 25 static & dynamic routes
- **TypeScript Static Typecheck:** 2.8 s
- **Compilation Duration:** 1.2 s
- **Page Optimization & Static Generation:** 1.3 s
- **Total Production Build Duration:** ~5.3 s

### 2.4 Automated Test Suite Execution Times
- **Backend Pytest Full Suite (47 test cases):**
  - Total duration: ~5 minutes (includes in-memory PostgreSQL transactions, SlowAPI throttling tests, and Argon2id key derivation runs).
  - Pass Rate: 100% (47 passed / 0 failed).
- **Go Collector Unit Tests:**
  - Total duration: < 0.5 s.
  - Pass Rate: 100%.
- **Playwright Browser E2E Suite (30 test specs):**
  - Total duration: 25.0 s (Chromium desktop headless).
  - Pass Rate: 100% (30 passed / 0 failed).

### 2.5 Memory & CPU Resource Footprint
- **WatchNet Backend (`uvicorn` FastAPI process):**
  - Idle RSS: ~58 MB
  - Under load (API sweeps & test requests): ~94 MB
- **Go Collector Daemon:**
  - Idle RSS: ~14 MB
  - During full subnet ARP/ICMP sweep: ~22 MB
- **Redis 7 Alpine:**
  - RSS: ~8 MB
- **PostgreSQL 16 Alpine:**
  - RSS: ~42 MB
