# WatchNet v1.0.0-rc.1 — Staging Burn-in Configuration Specification

**Document Identifier:** `WNET-DOC-BURNIN-CFG-001`  
**Version:** 1.0.0-rc.1  
**Status:** DRAFT / PENDING PHYSICAL AVAILABILITY GATES  
**Execution Target:** Dedicated Bare-Metal Linux Appliance (`x86_64` / `aarch64`)  
**Target Subnet:** `192.168.0.0/24` (or configured staging CIDR)  
**Burn-in Duration:** 72 Continuous Hours (Zero Critical Faults / Zero Memory Leaks)  

---

## 1. Executive Summary & Objective

This document defines the staging burn-in configuration parameters, environmental prerequisites, operating limits, pass/fail thresholds, and emergency abort conditions for validating **WatchNet v1.0.0-rc.1** on dedicated bare-metal appliance hardware prior to stable General Availability (`v1.0.0-stable`).

In strict conformance with Section 11 of the Master Directive and the Staging Availability Gates, burn-in validation must execute on **physical Linux hardware** with native Layer-2 broadcast domain visibility. Execution inside virtualized desktop wrappers (such as Docker Desktop on Windows 11 with Hyper-V/WSL2 NAT) is explicitly rejected for official release certification due to bridge-induced packet masking and lack of raw socket promiscuous capture.

---

## 2. Appliance Hardware & Network Prerequisites

Before burn-in initiation, the staging target must satisfy the following physical environment baseline:

### 2.1 Hardware Specification Gate
- **Architecture:** `x86_64` (Intel/AMD 4-core minimum, 2.0+ GHz) or `aarch64` (Raspberry Pi 4/5 4GB/8GB, Rockchip RK3588, Odroid N2+).
- **RAM:** Minimum 4 GB physical RAM (8 GB recommended for extended telemetry retention).
- **Storage:** Minimum 32 GB NVMe/eMMC/SATA SSD (Class 10 / U3 micro-SD permitted only with wear-leveling enabled).
- **Network Interface Card (NIC):** 1x Gigabit Ethernet (1000BASE-T) connected directly to an untagged access port on the core LAN switch. Virtual interfaces (NAT, vSwitch, Docker Desktop WSL proxy) are invalid for burn-in certification.

### 2.2 Network Topology & DNS Gate
- **Subnet:** Physical Layer-2 broadcast segment `192.168.0.0/24` (Gateway: `192.168.0.1`).
- **DNS Sinkhole Appliance:** Dedicated instance of **AdGuard Home** or **Pi-hole** listening on physical IP `192.168.0.2` (or designated appliance IP) on UDP/TCP port 53.
- **DHCP Option 6:** Gateway/DHCP server must broadcast the sinkhole IP as the primary and sole DNS resolver for all DHCP clients.
- **Firewall Rules:**
  - Ingress: Port 80 (HTTP), 443 (HTTPS), 3000 (Next.js UI), 8000 (FastAPI Core), 9090 (Telemetry Collector).
  - Sinkhole Egress: Port 53 (UDP/TCP upstream forward), 853 (DNS-over-TLS upstream forward).
  - Client Isolation: TCP/UDP port 853 blocked for general LAN clients to prevent DoT bypass.

---

## 3. Burn-in Operational Parameters & Service Profiles

The burn-in run executes WatchNet in continuous production profile under active background workloads:

```yaml
burn_in_profile:
  environment: staging_appliance
  run_duration_target_hours: 72
  orchestration: docker-compose.prod.yml
  services:
    - watchnet-backend:
        workers: 4
        log_level: INFO
        gc_threshold_kb: 524288 # 512 MB hard cap
    - watchnet-collector:
        interface: eth0
        raw_sockets: true
        arp_sweep_interval_sec: 15
        icmp_sweep_interval_sec: 60
        dns_ptr_concurrency: 16
    - watchnet-frontend:
        mode: standalone-node
        port: 3000
    - watchnet-postgres:
        shared_buffers: 256MB
        work_mem: 16MB
        wal_level: minimal
    - watchnet-redis:
        maxmemory: 256mb
        maxmemory_policy: volatile-lru
    - watchnet-caddy:
        ports: [80, 443]
        tls_mode: internal_ca
```

---

## 4. Sampling Windows & Telemetry Cadence

| Telemetry Domain | Mechanism | Frequency | Retention Target (72h) |
|:---|:---|:---:|:---:|
| **Host System Metrics** | Node Exporter / cgroup v2 stats | 10 seconds | 25,920 data points |
| **Collector L2 Discovery** | Raw ARP sweeps | 15 seconds | 17,280 sweeps |
| **Collector L3 Reachability** | ICMP echo batches (`fping`) | 60 seconds | 4,320 sweeps |
| **DNS Sinkhole Sync** | AdGuard / Pi-hole API poll | 30 seconds | 8,640 sync polls |
| **Process Resident Memory** | `/proc/[pid]/smaps` resident memory | 30 seconds | 8,640 samples |
| **Database Disk Growth** | PostgreSQL WAL & table sizing | 5 minutes | 864 snapshots |
| **Client Session Heartbeats** | Event Broker WebSocket / SSE | Continuous | Real-time event log |

---

## 5. Thresholds & Acceptance Limits

To qualify for stable General Availability (`v1.0.0-stable`), the entire 72-hour period must conform strictly to the following performance bounds:

1. **System Stability:**
   - Zero unhandled panics or SIGSEGV crashes across backend, collector, and database daemons.
   - Zero OOM killer activations (`dmesg` verification).
   - Service uptime $\ge 99.98\%$ (excluding scheduled restart test).
2. **Resource Consumption Caps:**
   - `watchnet-backend`: RSS $\le 350\text{ MB}$; maximum leak drift $\le 5\text{ KB/hour}$ after 12h warm-up.
   - `watchnet-collector`: RSS $\le 65\text{ MB}$; Goroutine count stable $\le 64$.
   - `watchnet-postgres`: Database storage growth $\le 15\text{ MB/day}$ with 100 tracked devices.
   - Host CPU utilization: Idle baseline $\le 5\%$; Peak discovery burst $\le 35\%$ on 4 cores.
3. **Network Discovery & Accuracy:**
   - 100% detection of active Layer-2 physical devices on broadcast domain within 45 seconds of appearance.
   - False positive device offline transitions $\le 0.05\%$.
   - Zero MAC-IP association collision corruption.
4. **DNS Policy Enforcement:**
   - Synchronization latency between WatchNet UI curfew rules and AdGuard/Pi-hole client rules $\le 5.0\text{ seconds}$.
   - Blocked query audit log ingestion parity $\ge 99.9\%$.

---

## 6. Stop Conditions & Emergency Abort Matrix

The automated burn-in harness must immediately flag a **FATAL BURN-IN BREACH** and halt qualification if any of the following occur:

| Breach Code | Trigger Event | Action | Remediation Requirement |
|:---|:---|:---:|:---|
| `ERR_LEAK_01` | Resident memory growth $> 100\text{ MB}$ within any 6-hour sliding window | Terminate run | Profile heap snapshots with `pprof` / `tracemalloc`. |
| `ERR_CRASH_02` | Uncaught fatal exception or process termination (exit code $\neq 0$) | Terminate run | Analyze core dump and backtrace. |
| `ERR_DATA_03` | SQLite / PostgreSQL transaction corruption or rollback storm ($>10$ errors/min) | Terminate run | Inspect foreign key constraints, connection pool starvation. |
| `ERR_NET_04` | Raw socket privilege drop or permission denied on `AF_PACKET` / `pcap` | Terminate run | Verify `CAP_NET_RAW` and `CAP_NET_ADMIN` capabilities. |
| `ERR_DNS_05` | Complete failure to communicate with physical DNS sinkhole for $> 5$ consecutive polls | Pause run | Inspect physical gateway, DNS appliance health, and network cable. |

---

## 7. Operational Runbook & Execution Steps

### Step 1: Pre-flight Verification
```bash
# Verify physical architecture and interface
uname -m
ip addr show eth0

# Verify raw socket and packet capture capabilities
sudo setcap cap_net_raw,cap_net_admin=eip /opt/watchnet/collector/collector

# Verify DNS sinkhole accessibility
curl -s -u admin:${SINKHOLE_PASS} http://192.168.0.2:80/control/status
```

### Step 2: Initialize Burn-in Harness
```bash
cd /opt/watchnet
export WATCHNET_ENV=staging_burnin
docker compose -f docker-compose.prod.yml up -d
python3 scripts/staging/burnin_watchdog.py --duration 72h --output /var/log/watchnet/burnin/
```

### Step 3: Conclude and Generate Sign-off Artifacts
Upon reaching hour 72:
1. Export complete Prometheus/node metrics: `python3 scripts/staging/export_telemetry.py`.
2. Inspect log registers for anomalies or warning spikes.
3. Archive SQLite/Postgres dump and compare row counters.
4. Complete and sign `BURN_IN_FINAL_REPORT.md`.
