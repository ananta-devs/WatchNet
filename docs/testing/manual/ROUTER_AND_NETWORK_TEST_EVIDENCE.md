# Router and Network Gateway Integration — Real-World & Simulation Evidence

**Test Period:** Phase 11 Final Acceptance Verification  
**Location:** `docs/testing/manual/`  
**Scope:** Gateway vendor protocol adapters, DHCP ingestion pipelines, Wi-Fi client telemetry, and DNS enforcement boundary integrity.

---

## 1. Gateway Protocol & Vendor Verification Matrix

| Gateway Type | Protocol / Auth Mechanism | Telemetry Extracted | Simulation / Live Status | Result |
|:---|:---|:---|:---|:---:|
| **Ubiquiti UniFi (UDM / Controller)** | UniFi REST API v2 (JWT / API Key) | Client MAC, IP, SSID, RSSI (dBm), Channel, Tx/Rx Rates | Simulated & Live Fixture | **VERIFIED** |
| **OpenWrt** | ubus JSON-RPC / LuCI Token Auth | DHCP Leases (`/tmp/dhcp.leases`), `hostapd_cli` associations | Automated Fixture Suite | **VERIFIED** |
| **ASUS Asuswrt-Merlin** | SSH / NVRAM + HTTP Hook | `nvram get dhcp_lease_table`, ARP cache | Integration Tested | **VERIFIED** |
| **AVM FRITZ!Box** | TR-064 SOAP / Digest Auth | Hosts list, WAN IP, link speed | Integration Tested | **VERIFIED** |
| **MikroTik RouterOS** | RouterOS REST API / API-SSL | `/ip/dhcp-server/lease`, `/interface/wireless/registration-table` | Integration Tested | **VERIFIED** |
| **TP-Link Omada SDN** | Omada Controller REST API | Station list, AP channel mapping, client signal | Integration Tested | **VERIFIED** |

---

## 2. DHCP Ingestion Verification Evidence

The WatchNet discovery engine features unified DHCP parser pipelines supporting multiple standard daemon dump formats:
1. **dnsmasq Format:**
   ```text
   1700000000 00:11:22:33:44:55 192.168.1.50 MacBookPro 01:00:11:22:33:44:55
   1700000000 aa:bb:cc:dd:ee:ff 192.168.1.120 ESP32-Sensor *
   ```
   *Ingestion Result:* Correctly extracted IP, MAC, hostname, and expiration timestamp.
2. **ISC DHCP Daemon (`dhcpd.leases`):**
   *Ingestion Result:* Validated nested block parsing with hardware ethernet matching.
3. **Kea DHCP JSON:**
   *Ingestion Result:* Ingested through Kea REST hooks and local database polling.

---

## 3. Wi-Fi Client RSSI & Band Analysis

WatchNet accurately translates raw wireless metrics into normalized user indicators:
- **Signal Quality Normalization:**
  - `> -50 dBm`: 4 bars (Excellent)
  - `-50 to -65 dBm`: 3 bars (Good)
  - `-65 to -75 dBm`: 2 bars (Fair)
  - `< -75 dBm`: 1 bar (Weak)
- **Band Categorization:** Automated detection of `2.4 GHz`, `5 GHz`, and `6 GHz` (Wi-Fi 6E/7).

---

## 4. DNS Policy Enforcement Boundaries & Safety Disclosures

WatchNet operates transparently at the network DNS resolver layer (AdGuard Home, Pi-hole, Technitium):

### Enforcement Architecture
```text
[Client Device] ─── DNS Query ───> [Pi-hole / AdGuard Home / WatchNet Resolver]
                                         │
                                         ▼ (Check Profile Policy & Bedtime Window)
                              ┌─────────────────────┐
                              │ Policy Check Passed │ ─── Forward ───> [Upstream DNS]
                              └─────────────────────┘
                                         │ (Blocked)
                                         ▼
                              [Return 0.0.0.0 / NXDOMAIN]
```

### Safety & Privacy Boundaries (Explicit Disclosure)
1. **No MITM SSL Decryption:** WatchNet does not perform TLS man-in-the-middle or inspect packet payloads.
2. **Encrypted DNS Vector Disclosures:** Devices utilizing DNS-over-HTTPS (DoH) or Apple iCloud Private Relay bypass local DNS unless gateway firewall rules redirect port 53/853 and drop public DoH IPs.
3. **Bedtime Enforcement:** Pausing internet shuts off local DNS resolution for the profile's mapped MAC addresses, preventing host lookups during bedtime periods.
