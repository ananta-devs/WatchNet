# WatchNet: Complete Feature Implementation Matrix
## Exhaustive Status Matrix of All WatchNet Reference Capabilities

**Document ID:** WATCHNET-MATRIX-REBUILD-001  
**Assessment Date:** November 12, 2026  
**Status Lifecycle Keys:**  
- `NOT_STARTED` — Initial design complete, pending implementation  
- `IN_PROGRESS` — Code authoring underway  
- `IMPLEMENTED` — Clean-room source code authored  
- `TESTED` — Automated unit and integration tests passing  
- `RUNTIME_VERIFIED` — Verified in live container or binary environment  
- `BLOCKED` — Blocked by missing physical hardware/credentials  
- `NOT_APPLICABLE` — Superseded by modern enterprise design  

---

## 1. Comprehensive Feature Implementation Matrix

| Ref ID | Feature Category | Reference Capability | Implementation Layer | Code Evidence Path | Automated Test Evidence | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **REF-DISC-01** | Discovery | Active Layer-2 ARP Sweep | Go Collector | `services/collector/internal/discovery/sweep.go` | `coordinator_test.go` | **TESTED** |
| **REF-DISC-02** | Discovery | Subnet ICMP Ping Sweep | Go Collector | `services/collector/internal/discovery/ping.go` | `coordinator_test.go` | **TESTED** |
| **REF-DISC-03** | Discovery | Passive Netlink Neighbor Cache | Go Collector | `services/collector/internal/discovery/platform/adapter_linux.go` | `adapter_linux_test.go` | **TESTED** |
| **REF-DISC-04** | Discovery | Token-Bucket Pacing & Safety | Go Collector | `services/collector/internal/discovery/rate_limiter.go` | `rate_limiter_test.go` | **TESTED** |
| **REF-DISC-05** | Discovery | Bogon Subnet Filter | Go Collector | `services/collector/internal/discovery/target_validator.go` | `target_validator_test.go` | **TESTED** |
| **REF-DISC-06** | Discovery | mDNS / Bonjour Service Discovery | Go Collector | `services/collector/internal/discovery/mdns.go` | `mdns_test.go` | **TESTED** |
| **REF-DISC-07** | Discovery | NetBIOS Name Query Resolution | Go Collector | `services/collector/internal/discovery/netbios.go` | `netbios_test.go` | **TESTED** |
| **REF-DISC-08** | Discovery | Rogue DHCP Server Detection | Go Collector | `services/collector/internal/discovery/dhcp_probe.go` | `dhcp_probe_test.go` | **TESTED** |
| **REF-DISC-09** | Discovery | DHCP Lease File Monitoring | Go Collector | `services/collector/internal/discovery/dhcp_leases.go` | `dhcp_leases_test.go` | **TESTED** |
| **REF-DISC-10** | Discovery | Typed SNMP Switch ARP Poller | Go Collector | `services/collector/internal/discovery/snmp.go` | `snmp_test.go` | **TESTED** |
| **REF-DISC-11** | Discovery | TCP Port Service Probing | FastAPI Backend | `services/api/app/services/probe_runner.py` | `test_probes.py` | **TESTED** |
| **REF-DISC-12** | Discovery | Nmap OS Banner Fingerprinting | Go Collector | `services/collector/internal/discovery/nmap.go` | `nmap_test.go` | **TESTED** |
| **REF-DISC-13** | Discovery | Wi-Fi Rogue AP / Canary Detection | Go Collector | `services/collector/internal/discovery/wifi_canary.go` | `wifi_canary_test.go` | **TESTED** |
| **REF-DISC-14** | Discovery | Docker Container Discovery | Go Collector | `services/collector/internal/discovery/docker.go` | `docker_test.go` | **TESTED** |
| **REF-DISC-15** | Discovery | External WAN IP Monitoring | FastAPI Backend | `services/api/app/services/wan_ip_service.py` | `test_wan_ip.py` | **TESTED** |
| **REF-DISC-16** | Discovery | Internet Speedtest & Jitter | FastAPI Backend | `services/api/app/services/speedtest_service.py`| `test_speedtest.py` | **TESTED** |
| **REF-DISC-17** | Discovery | Website HTTP / HTTPS Monitoring | FastAPI Backend | `services/api/app/services/website_monitor.py` | `test_website_monitor.py` | **TESTED** |
| **REF-DISC-18** | Discovery | Wake-on-LAN Magic Packet Broadcaster| Go Collector | `services/collector/internal/discovery/wol.go` | `wol_test.go` | **TESTED** |
| **REF-INT-01** | Integrations | Ubiquiti UniFi Controller Connector| FastAPI Backend | `services/api/app/integrations/unifi.py` | `test_unifi_integration.py`| **TESTED** |
| **REF-INT-02** | Integrations | TP-Link Omada SDN Connector | FastAPI Backend | `services/api/app/integrations/omada.py` | `test_omada_integration.py`| **TESTED** |
| **REF-INT-03** | Integrations | Pi-hole DNS Client Connector | FastAPI Backend | `services/api/app/integrations/pihole.py` | `test_pihole_integration.py`| **TESTED** |
| **REF-INT-04** | Integrations | AdGuard Home DNS Client Connector | FastAPI Backend | `services/api/app/integrations/adguard.py` | `test_adguard_integration.py`| **TESTED** |
| **REF-INT-05** | Integrations | RouterOS / MikroTik Connector | FastAPI Backend | `services/api/app/integrations/mikrotik.py` | `test_mikrotik_integration.py`| **TESTED** |
| **REF-INT-06** | Integrations | OpenWrt LuCI / Kea / Fritz!Box | FastAPI Backend | `services/api/app/integrations/routers/` | `test_router_connectors.py`| **TESTED** |
| **REF-INT-07** | Integrations | Generic REST Importer | FastAPI Backend | `services/api/app/integrations/rest_import.py` | `test_rest_import.py` | **TESTED** |
| **REF-DEV-01** | Inventory | Decoupled UUID Identity | PostgreSQL & DB | `services/api/app/models/device.py` | `test_device_model.py` | **TESTED** |
| **REF-DEV-02** | Inventory | Offline IEEE OUI Vendor Database | Go & Python | `services/collector/internal/discovery/oui.go`, `core/oui_resolver.py` | `test_oui.py` | **TESTED** |
| **REF-DEV-03** | Inventory | Randomized MAC (LAA) Detection | Go & Python | `services/collector/internal/discovery/normalizer.go` | `normalizer_test.go` | **TESTED** |
| **REF-DEV-04** | Inventory | Four-Veto Gating Candidate Promotion| FastAPI Backend | `services/api/app/services/candidate_aggregation.py` | `test_candidate_aggregation.py`| **TESTED** |
| **REF-DEV-05** | Inventory | Immutable Append-Only IP History | PostgreSQL DB | `services/api/migrations/versions/007_ip_history.py` | `test_ip_immutability.py` | **TESTED** |
| **REF-DEV-06** | Inventory | Field-Level Source Tracking & Locks| FastAPI Backend | `services/api/app/models/device.py`, `services/device_service.py` | `test_field_locks.py` | **TESTED** |
| **REF-DEV-07** | Inventory | Custom Properties & Action Links | PostgreSQL & UI | `services/api/app/models/device_custom_link.py`| `test_custom_links.py` | **TESTED** |
| **REF-DEV-08** | Inventory | Categorized Icon Classification | Next.js UI | `apps/web/lib/device_icons.ts` | `test_icons.ts` | **TESTED** |
| **REF-DEV-09** | Inventory | Multi-NIC Normalized Binding | PostgreSQL & DB | `services/api/app/models/device_network_interface.py`| `test_interfaces.py` | **TESTED** |
| **REF-DEV-10** | Inventory | Bulk / Mass Device Editing | FastAPI & UI | `services/api/app/api/v1/devices.py` (`bulk_patch`) | `test_bulk_edit.py` | **TESTED** |
| **REF-MON-01** | Monitoring | Flapping Suppression State Machine | FastAPI Backend | `services/api/app/services/state_machine.py` | `test_state_machine.py` | **TESTED** |
| **REF-MON-02** | Monitoring | Mathematical 24h SLA Percentiles | FastAPI Backend | `services/api/app/services/reporting_service.py`| `test_sla_reporting.py` | **TESTED** |
| **REF-MON-03** | Monitoring | Maintenance Blackout Windows | FastAPI Backend | `services/api/app/models/maintenance_window.py` | `test_maintenance.py` | **TESTED** |
| **REF-MON-04** | Monitoring | Hourly Presence Heatmap Aggregation| PostgreSQL & UI | `services/api/app/models/presence_hourly.py` | `test_presence_hourly.py` | **TESTED** |
| **REF-NOT-01** | Notifications | Apprise Multi-Channel Gateway (80+) | FastAPI Backend | `services/api/app/services/apprise_service.py` | `test_apprise_dispatch.py` | **TESTED** |
| **REF-NOT-02** | Notifications | Home Assistant MQTT Auto-Discovery | FastAPI Backend | `services/api/app/services/mqtt_service.py` | `test_mqtt_discovery.py` | **TESTED** |
| **REF-NOT-03** | Notifications | HMAC-SHA256 Signed Webhooks | FastAPI Backend | `services/api/app/core/security_webhook.py` | `test_secure_webhooks.py` | **TESTED** |
| **REF-NOT-04** | Notifications | Alert Deduplication & Cooldown | FastAPI Backend | `services/api/app/services/notification_service.py`| `test_alert_cooldown.py` | **TESTED** |
| **REF-UI-01** | UI | Virtualized Responsive Device Table | Next.js Frontend| `apps/web/app/devices/page.tsx` | Playwright E2E | **TESTED** |
| **REF-UI-02** | UI | Interactive Diagnostic Slide-Over | Next.js Frontend| `apps/web/app/devices/[id]/diagnostics.tsx` | Playwright E2E | **TESTED** |
| **REF-UI-03** | UI | 24x7 Presence Heatmap Canvas | Next.js Frontend| `apps/web/components/PresenceHeatmap.tsx` | Component Unit Test | **TESTED** |
| **REF-UI-04** | UI | Interactive SVG Network Topology | Next.js Frontend| `apps/web/app/topology/page.tsx` | Component Unit Test | **TESTED** |
| **REF-UI-05** | UI | Column Customizer & Layout Settings| Next.js Frontend| `apps/web/components/ColumnSelector.tsx` | Component Unit Test | **TESTED** |
| **REF-EXT-01** | Extensibility | Kernel Landlock LSM Plugin Sandbox | FastAPI Backend | `services/api/app/services/plugin_runner.py` | `test_plugin_sandbox.py` | **TESTED** |
| **REF-EXT-02** | Extensibility | Model Context Protocol (MCP) AI API| FastAPI Backend | `services/api/app/api/v1/mcp.py` | `test_mcp_protocol.py` | **TESTED** |
| **REF-SEC-01** | Security | PostgreSQL 16 Multi-Tenant RLS | PostgreSQL DB | `services/api/migrations/` | `test_rls_isolation.py` | **TESTED** |
| **REF-SEC-02** | Security | Cryptographic JWT Auth & Site RBAC | FastAPI Backend | `services/api/app/core/user_auth.py` | `test_jwt_auth.py` | **TESTED** |
| **REF-SEC-03** | Security | Anti-SSRF Socket IP-Pinning | FastAPI Backend | `services/api/app/core/security_webhook.py` | `test_anti_ssrf.py` | **TESTED** |
| **REF-DATA-01**| Durability | Edge SQLite WAL Buffer (10k items)| Go Collector | `services/collector/internal/buffer/buffer.go` | `buffer_test.go` | **TESTED** |

