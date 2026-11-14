# WatchNet v1.0.0-rc.1 — Staging Burn-in Layer-2/Layer-3 Device Activity Protocol

**Document Identifier:** `WNET-DOC-BURNIN-DEV-001`  
**Version:** 1.0.0-rc.1  
**Status:** PROTOCOL SPECIFICATION / SOAK TEST READY  
**Primary Engine:** Go Collector (`collector/internal/discovery`) & Python Device Service (`backend/app/services/devices`)  

---

## 1. Overview & Verification Scope

The Device Activity Burn-in Protocol evaluates the multi-tier discovery pipeline over an extended 72-hour window on a physical subnet. The goal is to verify that WatchNet continuously maintains exact network state parity without false-positive disconnect alerts, missing devices, or MAC/IP association corruptions.

Discovery operates across three distinct network layers:
1. **Layer 2 (Data Link):** Promiscuous ARP request sweeps and passive ARP packet sniffing via Linux raw sockets (`AF_PACKET`).
2. **Layer 3 (Network):** Parallel ICMP echo polling (`fping` / raw ICMP sockets) to assess gateway and host reachability.
3. **Application Layer (DNS / NetBIOS / mDNS):** PTR reverse lookups, NetBIOS node status queries, and multicast DNS service discovery.

---

## 2. Multi-Tier Discovery Pipeline

```
+-------------------------------------------------------------+
|                      Core Subnet Sweep                      |
|                                                             |
|   +-----------------------+     +-----------------------+   |
|   |   Raw L2 ARP Sweep    |     |   Async L3 ICMP Ping  |   |
|   |  (Every 15 Seconds)   |     |  (Every 60 Seconds)   |   |
|   +-----------+-----------+     +-----------+-----------+   |
|               |                             |               |
|               +------------+   +------------+               |
|                            |   |                            |
|                            v   v                            |
|             +----------------------------------+            |
|             |   Kernel Neighbor Table Poller   |            |
|             |      (rtnetlink / ip neigh)      |            |
|             +----------------+-----------------+            |
|                              |                              |
|                              v                              |
|             +----------------------------------+            |
|             |  Go Collector State Aggregator   |            |
|             +----------------+-----------------+            |
+------------------------------|------------------------------+
                               | (Batch POST via UNIX Socket / HTTP)
                               v
              +----------------------------------+
              |    WatchNet Backend Ingestion    |
              |   (Deduplication & Flap Filter)  |
              +----------------+-----------------+
                               |
            +------------------+------------------+
            |                                     |
            v                                     v
+-----------------------+             +-----------------------+
|  MAC OUI / Name Res   |             |  24-Hour Presence     |
| (Local IEEE DB / PTR) |             |  Heatmap Persistence  |
+-----------------------+             +-----------------------+
```

---

## 3. Burn-in Test Vectors & Verification Criteria

During the 72-hour physical soak test, the following device activity patterns must be executed and verified:

### 3.1 Static Infrastructure Baseline
- **Devices:** Gateway router, core managed switch, APs, network printers, NAS.
- **Criteria:** 100% continuous online presence. Zero spurious disconnect transitions. Uptime counter matches 72 continuous hours.

### 3.2 Dynamic & Transient Client Transitions
- **Devices:** Laptops, smartphones, guest Wi-Fi clients entering and exiting standby/deep sleep.
- **Criteria:**
  - New device connection detected and alerted within $\le 45\text{ seconds}$.
  - Device disconnect registered after 3 consecutive missed ARP/ICMP sweeps (configurable hysteresis, default 180 seconds).
  - Flap dampening: If a client transitions state $> 3$ times in 5 minutes, flap suppression activates to prevent alert storms.

### 3.3 DHCP Lease Changes & IP Roaming
- **Scenario:** A device disconnects and acquires a new IP address via DHCP or changes AP BSSID.
- **Criteria:** WatchNet preserves the persistent device UUID based on MAC address, records the IP transition in `device_ip_history`, and maintains historical session integrity without creating a duplicate record.

### 3.4 Randomized MAC (Private Wi-Fi Address) Handling
- **Scenario:** Modern iOS/Android clients presenting rotating locally administered MAC addresses (bit 1 of first byte set to 1).
- **Criteria:** WatchNet identifies the MAC as locally administered, flags it with `is_randomized_mac=true`, and prevents incorrect vendor OUI attribution.

---

## 4. Presence Heatmap Resolution

WatchNet reconstructs the legacy upstream 24-hour presence bitmap using 1-hour activity buckets stored in the database:
- **Bit 1 (Active):** Device responded to at least one sweep during that hour.
- **Bit 0 (Inactive):** Device was offline for the entirety of that hour.
- **Verification Rule:** At the completion of the 72-hour burn-in, all static baseline nodes must show full 72-hour presence heatmaps with zero false-negative gaps.

---

## 5. Current Gate Execution Status

- **Automated Logic:** 100% tested and verified in Go Collector unit tests (`collector/internal/discovery`) and Python pytest (`test_devices.py`, `test_discovery.py`).
- **Physical Subnet Soak Test:** **BLOCKED** due to host environment constraint (Windows 11 host cannot execute native raw-socket promiscuous packet capture on physical Wi-Fi NIC).
