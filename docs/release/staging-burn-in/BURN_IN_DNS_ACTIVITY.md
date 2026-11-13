# WatchNet v1.0.0-rc.1 — Staging Burn-in DNS Activity & Filtering Validation Protocol

**Document Identifier:** `WNET-DOC-BURNIN-DNS-001`  
**Version:** 1.0.0-rc.1  
**Status:** PROTOCOL SPECIFICATION & LIMITATIONS AUDIT  
**Target Engines:** AdGuard Home REST API / Pi-hole FTL API / WatchNet Family Safety Core  

---

## 1. Overview & Verification Scope

The DNS Activity & Filtering Burn-in Protocol governs the continuous synchronization, policy enforcement, bedtime curfew automation, and audit ingestion between WatchNet and downstream DNS sinkhole appliances over the 72-hour burn-in period.

In accordance with Section 11 of the Master Directive, this protocol mandates exact, honest documentation regarding the physical operational boundaries of DNS sinkhole enforcement, specifically addressing modern encrypted DNS protocols (DoH/DoT) and VPN tunnels.

---

## 2. DNS Sinkhole Integration Architecture

```
                       [ WatchNet Dashboard ]
                                 |
                     (REST / Bedtime Schedule)
                                 v
                +---------------------------------+
                |   WatchNet Family Safety Core   |
                |  (backend/app/services/family)  |
                +----------------+----------------+
                                 |
                 (Sync Client Tags & Blocklists)
                                 v
                +---------------------------------+
                |    AdGuard Home / Pi-hole v5    |
                |   (Physical Appliance: 53/UDP)  |
                +----------------+----------------+
                                 |
                 +---------------+---------------+
                 |                               |
                 v                               v
       [ Standard Plaintext ]          [ Encrypted DoH / DoT ]
       Queries via 53/UDP/TCP          Bypasses Sinkhole Directly
                 |                               |
                 v                               v
        +-----------------+             +-----------------+
        | Filtered / Log  |             | Unfiltered ISP  |
        |  According to   |             |   or Public     |
        |  WatchNet Rules |             |   Resolver      |
        +-----------------+             +-----------------+
                                                 ^
                                                 |
                                     (REQUIRES PERIMETER FIREWALL
                                     TO DROP TCP/UDP 853 & DOH IPS)
```

---

## 3. Physical Sinkhole Validation Vectors (72-Hour Soak)

When physical hardware is provisioned, the staging harness executes four continuous DNS validation vectors:

### 3.1 Bedtime Curfew Automation
- **Scenario:** A device tagged under the "Children" profile enters curfew at 21:00.
- **Criteria:**
  - At 21:00:00, WatchNet dispatches an API update to AdGuard/Pi-hole adding the device IP/MAC to the global block rule.
  - End-to-end propagation time: $\le 5.0\text{ seconds}$.
  - Subsequent DNS queries for any domain from that client return `NXDOMAIN` or `0.0.0.0`.
  - At 07:00:00 the following morning, curfew lifts and normal resolution resumes.

### 3.2 Category-Based Web Filtering
- **Scenario:** Adult content, gambling, and malware domains are blocked for specific profiles.
- **Criteria:**
  - WatchNet pushes upstream blocklists and custom domain regex rules.
  - Test client attempts query for `malware-test.com` and `adult-test.net`.
  - Sinkhole logs query as `BLOCKED_BY_FILTER` and returns `0.0.0.0`.
  - WatchNet pulls sinkhole audit log within 30 seconds and attributes blocked attempts to the client profile.

### 3.3 Query Ingestion & Telemetry Throughput
- **Scenario:** Continuous stream of 500 queries/minute passing through the sinkhole.
- **Criteria:**
  - WatchNet polls sinkhole stats every 30 seconds.
  - Zero dropped query statistics.
  - Zero memory accumulation in the WatchNet ingestion adapter.

---

## 4. Operational Boundaries & Bypass Limitations

In adherence to Section 10 and 11 of the Master Directive ("Do not claim complete browsing history from DNS records; do not claim router support without testing it"), the following limitations are formally defined:

### 4.1 DNS-over-HTTPS (DoH) & DNS-over-TLS (DoT) Bypass
- **Vulnerability:** Modern browsers (Chrome Secure DNS, Firefox DoH, Apple Private Relay, Android Private DNS) bypass local DHCP DNS (port 53) by sending HTTPS requests directly to Cloudflare (`1.1.1.1`), Google (`8.8.8.8`), or Apple relay endpoints over port 443/853.
- **Mitigation Requirement:** A DNS sinkhole alone **CANNOT** block DoH without perimeter firewall cooperation:
  1. Port 853 (DoT) must be blocked at the gateway firewall.
  2. Known DoH IP blocks must be dropped at Layer 3/4.
  3. Canary domains (`use-application-dns.net`) must be configured to return `NXDOMAIN` to prompt browsers to disable automatic DoH fallback.

### 4.2 VPN & Tor Tunnels
- **Vulnerability:** Encrypted VPN tunnels (WireGuard, OpenVPN, Tailscale, NordVPN) route all client traffic through a virtual interface, completely bypassing local DNS sinkhole enforcement.
- **Mitigation:** Requires deep packet inspection (DPI) or perimeter firewall blocking of external VPN ports (UDP 51820, UDP 1194). WatchNet operates at the network discovery and DNS sync layer, not as an inline UTM firewall.

### 4.3 Client-Configured Static DNS
- If a client manually configures `8.8.8.8` as its DNS resolver on its device network settings, queries bypass port 53 DHCP distribution unless the router NAT redirects all outbound port 53 traffic to the local sinkhole appliance.

---

## 5. Burn-in Start Gate Inspection Finding

```text
[DNS Audit Result]
Host Subnet: 192.168.0.0/24
Gateway: 192.168.0.1 (ISP Residential Gateway)
Physical AdGuard / Pi-hole IP: 192.168.0.2 -> NOT PRESENT
Port 53 Probe (192.168.0.2): CONNECTION TIMED OUT
API Health Probe: FAILED (Target unreachable)
Verdict: BLOCKED AT AVAILABILITY GATE
```

No physical DNS sinkhole is present on the network. The automated tests pass against isolated contract fixtures (`backend/tests/test_routers_and_family_safety.py`), but physical wire validation remains blocked until physical sinkhole hardware is deployed.
