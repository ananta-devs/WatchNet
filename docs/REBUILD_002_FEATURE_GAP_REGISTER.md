# WatchNet Rebuild 002 — Feature Gap & Implementation Register

**Task ID:** WATCHNET-REBUILD-002  
**Baseline Date:** 2026-11-12  
**Workspace:** `D:\WatchNet`  
**Reference Benchmark:** `D:\NetAlertX-main\NetAlertX-main`

---

## 1. Classification Definitions

- **LIVE_RUNTIME_VERIFIED:** Feature operates against real runtime services and has verified UI/DB evidence.
- **INTEGRATION_TESTED:** Feature verified with an automated integration test against real or local test double.
- **AUTOMATED_TESTED:** Feature has passing unit/functional tests.
- **IMPLEMENTED_NOT_TESTED:** Code is authored and compiles, but lacks live end-to-end runtime proof.
- **PARTIALLY_IMPLEMENTED:** Core logic exists but lacks full UI integration, database binding, or edge handling.
- **MOCK_ONLY:** Returns simulated data; not connected to live underlying subsystems.
- **BLOCKED:** Requires physical external equipment (e.g. real Cisco switch, physical UniFi Dream Machine) or privileges not present in container/OS sandbox.
- **NOT_IMPLEMENTED:** Missing from current implementation.

---

## 2. Feature-by-Feature Gap Register

### Category 1: Network Discovery & Packet Sweeping

| ID | NetAlertX Capability | Current WatchNet Implementation | Current Status | Gap / Required Action |
| :--- | :--- | :--- | :---: | :--- |
| **DISC-01** | Raw ARP scanning | Go Collector `sweep.go` (TCP connect fallback on Windows) | `AUTOMATED_TESTED` | Test in Docker container with Linux network bridge |
| **DISC-02** | ICMP ping sweeping | Go Collector `ping.go` / API `probe_runner.py` | `AUTOMATED_TESTED` | Verify end-to-end latency measurement |
| **DISC-03** | IPv6 Neighbor Discovery (NDP) | Model supports IPv6, collector has IPv6 skeleton | `PARTIALLY_IMPLEMENTED` | Complete Go collector IPv6 listener |
| **DISC-04** | Multicast DNS (mDNS) discovery | Go Collector `mdns.go` | `AUTOMATED_TESTED` | Test query parsing on 224.0.0.251:5353 |
| **DISC-05** | NetBIOS name resolution | Go Collector `netbios.go` (UDP 137) | `AUTOMATED_TESTED` | Verify NBNS status parsing on live host |
| **DISC-06** | Rogue DHCP detection | Go Collector `dhcp_probe.go` (UDP 67/68) | `AUTOMATED_TESTED` | Run isolated Docker DHCP server test |
| **DISC-07** | SNMP ARP table poller | Go Collector `snmp.go` | `PARTIALLY_IMPLEMENTED` | Implement full ASN.1 / SNMP v2c GET-BULK parser |
| **DISC-08** | Token-bucket rate limiting | Go Collector `rate_limiter.go` | `AUTOMATED_TESTED` | Pacing verified (100 PPS default) |
| **DISC-09** | Offline observation buffering | Go Collector `buffer.go` (pure Go JSON WAL queue) | `AUTOMATED_TESTED` | Verify drain loop on API reconnect |
| **DISC-10** | Multi-subnet scheduling | Go Collector `main.go` loop | `IMPLEMENTED_NOT_TESTED` | Test multi-subnet sweep configuration in Docker |

### Category 2: Device Lifecycle, Inventory & Identity

| ID | NetAlertX Capability | Current WatchNet Implementation | Current Status | Gap / Required Action |
| :--- | :--- | :--- | :---: | :--- |
| **DEV-01** | IEEE OUI vendor resolution | `app/core/oui_resolver.py` | `AUTOMATED_TESTED` | Verify offline Trie lookup < 0.05ms |
| **DEV-02** | RFC 7042 Randomized MAC detection | `app/core/oui_resolver.py` (`is_laa_randomized`) | `AUTOMATED_TESTED` | LAA bit 1 check verified |
| **DEV-03** | 4-Veto candidate promotion | `app/services/device_service.py` | `AUTOMATED_TESTED` | Verify multi-signal promotion flow |
| **DEV-04** | Attribute locking (name, vendor, etc.) | `app/services/device_service.py` (`locked_fields`) | `AUTOMATED_TESTED` | Verify UI toggle updates DB locked_fields |
| **DEV-05** | IP address history ledger | `app/models/device.py` (`DeviceIPAddress`) | `AUTOMATED_TESTED` | Verify immutable append-only ledger on IP shift |
| **DEV-06** | Multi-NIC normalization | `DeviceNetworkInterface` relationship | `AUTOMATED_TESTED` | Verify device with dual MACs (Ethernet + Wi-Fi) |
| **DEV-07** | Custom device action links | `DeviceCustomLink` model & schema | `PARTIALLY_IMPLEMENTED` | Add interactive UI link editor in Device details |
| **DEV-08** | Key-value tagging & grouping | `DeviceTag` model & schema | `PARTIALLY_IMPLEMENTED` | Add tag badge component in frontend |
| **DEV-09** | Bulk device editing | `bulk-update` API endpoint | `IMPLEMENTED_NOT_TESTED` | Connect frontend multi-select checkbox to bulk patch |
| **DEV-10** | Device archiving & deletion | `is_archived` column and filter | `IMPLEMENTED_NOT_TESTED` | Test archive/unarchive action in Chrome |

### Category 3: Availability & Telemetry Monitoring

| ID | NetAlertX Capability | Current WatchNet Implementation | Current Status | Gap / Required Action |
| :--- | :--- | :--- | :---: | :--- |
| **MON-01** | ICMP ping latency monitor | `app/services/probe_runner.py` | `AUTOMATED_TESTED` | Verify latency persistence in `probe_results` |
| **MON-02** | TCP port health check | `app/services/probe_runner.py` | `AUTOMATED_TESTED` | Verify socket timeout handling |
| **MON-03** | HTTP/HTTPS synthetic check | `app/services/probe_runner.py` | `AUTOMATED_TESTED` | Verify HTTP status code comparison |
| **MON-04** | 24-hour hourly presence heatmap | `app/services/presence_service.py` | `AUTOMATED_TESTED` | Test real browser rendering of 24h heatmap |
| **MON-05** | Presence session tracking | `app/models/presence.py` (`DeviceSession`) | `AUTOMATED_TESTED` | Verify connect/disconnect duration tracking |
| **MON-06** | Scheduled maintenance windows | `MaintenanceWindow` model & schema | `IMPLEMENTED_NOT_TESTED` | Wire alert suppression check during active window |
| **MON-07** | Fleet presence rollups | `app/api/v1/presence.py` (`/summary`) | `AUTOMATED_TESTED` | Verify dashboard cards render live stats |

### Category 4: Notifications & Alert Engine

| ID | NetAlertX Capability | Current WatchNet Implementation | Current Status | Gap / Required Action |
| :--- | :--- | :--- | :---: | :--- |
| **NOTIF-01** | Apprise multi-channel gateway | `app/services/apprise_service.py` | `AUTOMATED_TESTED` | Verify live webhook dispatch with SSRF protection |
| **NOTIF-02** | Home Assistant MQTT autodiscovery | `app/services/mqtt_service.py` | `AUTOMATED_TESTED` | Verify JSON discovery schema matches HA spec |
| **NOTIF-03** | Alert deduplication & throttling | `app/services/notification_service.py` | `AUTOMATED_TESTED` | Verify 5-minute flood suppression window |
| **NOTIF-04** | Interactive alert acknowledgment | `app/api/v1/notifications.py` | `IMPLEMENTED_NOT_TESTED` | Connect UI button to acknowledge / resolve |
| **NOTIF-05** | Outbound Webhook HMAC-SHA256 | `app/core/security_webhook.py` | `AUTOMATED_TESTED` | Verified signature generation & timestamp |

### Category 5: Diagnostics, Integrations & Ecosystem

| ID | NetAlertX Capability | Current WatchNet Implementation | Current Status | Gap / Required Action |
| :--- | :--- | :--- | :---: | :--- |
| **DIAG-01** | Interactive ICMP ping CLI | `app/services/diagnostics_service.py` | `AUTOMATED_TESTED` | Verify in Chrome browser workbench |
| **DIAG-02** | Interactive TCP port scanner | `app/services/diagnostics_service.py` | `AUTOMATED_TESTED` | Verify common port identification (SSH, HTTP, etc.) |
| **DIAG-03** | Wake-on-LAN magic packet | `app/services/diagnostics_service.py` | `AUTOMATED_TESTED` | 102-byte frame generation verified |
| **DIAG-04** | Safe traceroute hop inspection | `app/services/diagnostics_service.py` | `IMPLEMENTED_NOT_TESTED` | Verify output parsing across Windows/Linux |
| **INT-01** | UniFi Controller integration | `app/integrations/unifi.py` | `IMPLEMENTED_NOT_TESTED` | Test with simulated UniFi Controller endpoint |
| **INT-02** | TP-Link Omada SDN integration | `app/integrations/omada.py` | `IMPLEMENTED_NOT_TESTED` | Test OpenAPI client authentication |
| **INT-03** | Pi-hole DNS sinkhole client | `app/integrations/pihole.py` | `IMPLEMENTED_NOT_TESTED` | Test client import from mock Pi-hole API |
| **INT-04** | AdGuard Home integration | `app/integrations/adguard.py` | `IMPLEMENTED_NOT_TESTED` | Test client import from mock AdGuard API |
| **MCP-01** | Anthropic Model Context Protocol | `app/api/v1/mcp.py` | `AUTOMATED_TESTED` | Verify `tools/list` and `tools/call` JSON-RPC |

