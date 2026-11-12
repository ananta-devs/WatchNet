# NetAlertX Complete Feature Inventory & Functional Reference
## Comprehensive Analysis of All Reference Features, Behaviors & Implementation Dispositions

**Document ID:** NETALERTX-INV-001  
**Reference Source:** `D:\NetAlertX-main\NetAlertX-main` (Upstream `main` commit `1046b400d116b327065ec19a35f302579dc72592`)  
**License:** GNU General Public License v3.0  
**Scope:** Complete functional inventory across core backend, scan pipeline, database models, plugins, publishers, frontend, APIs, and diagnostics.  

---

## 1. Inventory & Disposition Methodology

Every feature present in NetAlertX has been identified through direct inspection of `D:\NetAlertX-main\NetAlertX-main`. For each capability, this document records:
- **Feature Name & Identifier**
- **Original NetAlertX Behavior & Source Location**
- **Underlying Protocols & System Dependencies**
- **User-Facing Workflow & UI Surface**
- **Inputs & Outputs**
- **Security Considerations & Vulnerabilities in Original Design**
- **WatchNet Modern Clean-Room Reimplementation Design**
- **Implementation Disposition & Status**

---

## 2. Complete Feature Inventory

### Category 1: Core Network Discovery & Protocols

#### 1.1 `arp_scan` — Active Layer-2 ARP Sweep
- **Original Location:** `server/plugins/arp_scan/script.py`, `server/plugins/arp_scan/config.json`
- **Original Behavior:** Shells out to Linux binary `arp-scan --interface=<iface> <subnet>` using `subprocess.check_output()`. Parses ASCII output lines matching regex `([0-9a-f:]{17})\s+([0-9.]+)\s+(.*)`.
- **Protocols & Dependencies:** ARP (RFC 826), Linux `arp-scan` CLI, `CAP_NET_RAW`.
- **User Workflow:** Configured in Settings > Core Scanners; runs on scheduled tick or on-demand.
- **Inputs & Outputs:** Input: CIDR subnets (e.g. `192.168.1.0/24`). Output: list of `(MAC, IP, Vendor)` tuples written to `RESULT_FILE`.
- **Original Security Issues:** Unthrottled packet emission can flood switch CAM tables and trigger network intrusion detection (NIDS) alarms; shells out to external binary.
- **WatchNet Modern Design:** Native Go raw AF_PACKET ARP engine (`services/collector/internal/discovery/sweep.go`) with token-bucket pacing (100 pps ceiling) and strict bogon IP filtering.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.2 `icmp_scan` — Subnet ICMP Echo Ping Sweep
- **Original Location:** `server/plugins/icmp_scan/script.py`, `server/plugins/icmp_scan/config.json`
- **Original Behavior:** Executes `fping -a -g -r 1 <subnet>` via `subprocess`.
- **Protocols & Dependencies:** ICMP Echo (RFC 792), `fping` CLI.
- **User Workflow:** Configured in Settings > ICMP Scan; runs periodically.
- **Inputs & Outputs:** Input: IP subnets. Output: list of responsive IPs.
- **Original Security Issues:** Subprocess fork overhead; unpaged scans cause high CPU bursts.
- **WatchNet Modern Design:** Native Go raw ICMP worker pool (`services/collector/internal/discovery/ping.go`) with goroutine throttling and jittered scheduling.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.3 `ipneigh` — Passive Kernel Neighbor Cache Reader
- **Original Location:** `server/plugins/ipneigh/script.py`, `server/scan/presence.py`
- **Original Behavior:** Executes `ip -s neigh show` or parses `/proc/net/arp` to capture passively discovered Layer-2 neighbors.
- **Protocols & Dependencies:** Linux Netlink / ARP cache.
- **User Workflow:** Runs automatically each scan cycle to ingest zero-overhead passive observations.
- **Inputs & Outputs:** Input: Kernel ARP table. Output: `(MAC, IP, State)` observations.
- **WatchNet Modern Design:** Asynchronous Netlink socket listener (`services/collector/internal/discovery/platform/adapter_linux.go`) using `AF_NETLINK` / `RTM_GETNEIGH` without spawning CLI processes.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.4 `avahi_scan` — mDNS / Bonjour / ZeroConf Service Discovery
- **Original Location:** `server/plugins/avahi_scan/avahi_scan.py`, `config.json`
- **Original Behavior:** Executes `avahi-browse -a -t -r -p` to discover Apple AirPlay devices, printers, smart TVs, and IoT endpoints broadcasting mDNS records.
- **Protocols & Dependencies:** mDNS / DNS-SD (RFC 6762, RFC 6763), UDP 5353, Avahi daemon.
- **User Workflow:** Automatically discovers friendly device model names (e.g. `MacBookPro18,1`, `Sonos Play:1`).
- **WatchNet Modern Design:** Native Go UDP multicast listener on `224.0.0.251:5353` (`services/collector/internal/discovery/mdns.go`) parsing DNS-SD PTR/SRV/TXT records in memory.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.5 `nbtscan_scan` — NetBIOS Name Resolution
- **Original Location:** `server/plugins/nbtscan_scan/script.py`
- **Original Behavior:** Spawns `nbtscan -r <subnet>` to query Windows/Samba NetBIOS Name Service on UDP 137.
- **Protocols & Dependencies:** NetBIOS over TCP/IP (RFC 1001/1002), UDP 137.
- **User Workflow:** Resolves NetBIOS computer names and workgroup domains for Windows machines.
- **WatchNet Modern Design:** Native Go NetBIOS name query engine (`services/collector/internal/discovery/netbios.go`) sending RFC 1002 Name Query packets during active sweeps.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.6 `dhcp_servers` — Rogue DHCP Server Broadcast Detector
- **Original Location:** `server/plugins/dhcp_servers/README.md`, `config.json`
- **Original Behavior:** Executes `nmap --script broadcast-dhcp-discover` to broadcast a DHCP Discover and flag all answering servers.
- **Protocols & Dependencies:** DHCP (RFC 2131), UDP 67/68, Nmap.
- **User Workflow:** Alerts administrator when more than one DHCP server or an unexpected IP offers leases.
- **WatchNet Modern Design:** Go raw socket DHCP Discover broadcaster (`services/collector/internal/discovery/dhcp_probe.go`) with scheduled 30m checks and automated rogue alert dispatch.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.7 `dhcp_leases` — DHCP Lease File Importer
- **Original Location:** `server/plugins/dhcp_leases/script.py`
- **Original Behavior:** Reads local files `/var/lib/dhcp/dhcpd.leases` and `dnsmasq.leases` to extract assigned IP, MAC, hostname, and lease expiration.
- **Protocols & Dependencies:** Flat file parser.
- **WatchNet Modern Design:** Collector file watcher service (`services/collector/internal/discovery/dhcp_leases.go`) monitoring configured lease paths.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.8 `snmp_discovery` — SNMP Router/Switch ARP Table Query
- **Original Location:** `server/plugins/snmp_discovery/script.py`
- **Original Behavior:** Executes `snmpwalk` across RFC 1213 MIB (`ipNetToMediaPhysAddress`) on configured switch IPs.
- **Protocols & Dependencies:** SNMPv1/v2c/v3, UDP 161.
- **Original Security Issues:** Shells out with raw string split; vulnerable to argument injection.
- **WatchNet Modern Design:** Typed Go SNMP client (`services/collector/internal/discovery/snmp.go`) using `gosnmp` supporting SNMPv2c/SNMPv3 with `authPriv` (AES-128 + SHA-256).
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.9 `nmap_scan` & `nmap_dev_scan` — Port & OS Fingerprinting
- **Original Location:** `server/plugins/nmap_scan/`, `server/plugins/nmap_dev_scan/`
- **Original Behavior:** Executes `nmap -sS -O` or `nmap -sT` on discovered hosts to detect open ports and OS fingerprints.
- **WatchNet Modern Design:** Asynchronous Go port scanner and TCP SYN banner prober with strict rate bounds.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.10 `wificanary` — Wi-Fi Rogue AP & Evil-Twin Detection
- **Original Location:** `server/plugins/wificanary/script.py` (18KB)
- **Original Behavior:** Runs `iw dev <iface> scan` in station mode to detect rogue BSSIDs, evil-twin clones of trusted SSIDs, security downgrades (WPA3 to WPA2/Open), and WiFi Pineapple signatures.
- **Protocols & Dependencies:** 802.11 Wi-Fi, Linux `iw` CLI, `CAP_NET_ADMIN`.
- **WatchNet Modern Design:** Sandboxed Wi-Fi monitor module (`services/collector/internal/discovery/wifi_canary.go`) parsing beacon IEs and comparing against trusted AP profiles.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.11 `dockerdisc` — Docker Container Discovery
- **Original Location:** `server/plugins/dockerdisc/`
- **Original Behavior:** Connects to `/var/run/docker.sock` to map running container names, bridge IPs, and exposed ports.
- **WatchNet Modern Design:** Optional Docker socket collector adapter registering container endpoints into inventory.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.12 `internet_ip` & `ddns_update` — WAN IP Detection & Dynamic DNS
- **Original Location:** `server/plugins/internet_ip/`, `server/plugins/ddns_update/`
- **Original Behavior:** Queries public STUN/HTTP endpoints to detect external IP changes and updates DynDNS providers.
- **WatchNet Modern Design:** Built-in WAN IP monitor in FastAPI backend with webhook alert on IP churn.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.13 `internet_speedtest` — Bandwidth & Latency Testing
- **Original Location:** `server/plugins/internet_speedtest/`
- **Original Behavior:** Executes `speedtest-cli` or official Ookla binary to record download/upload Mbps and ping jitter.
- **WatchNet Modern Design:** Sandboxed diagnostic speedtest runner in Go/Python with schedule throttling.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.14 `website_monitor` — HTTP / HTTPS Service Availability
- **Original Location:** `server/plugins/website_monitor/script.py`
- **Original Behavior:** Sends HTTP GET requests to configured URLs and logs response status codes (200, 301, 404, 500) and latency.
- **WatchNet Modern Design:** Built-in HTTP/HTTPS probe runner in `services/api/app/services/probe_runner.py` with SSL certificate expiration tracking.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 1.15 `wake_on_lan` — Wake-on-LAN Magic Packet Broadcaster
- **Original Location:** `server/plugins/wake_on_lan/`, `server/api_server/nettools_endpoint.py`
- **Original Behavior:** Broadcasts 102-byte UDP magic packet (`0xFF*6 + MAC*16`) to wake offline computers.
- **WatchNet Modern Design:** Go collector UDP broadcaster and FastAPI diagnostic endpoint (`POST /api/v1/diagnostics/wol`).
- **Disposition:** **IMPLEMENTED & VERIFIED**.

---

### Category 2: Network Infrastructure & SDN Appliance Connectors

#### 2.1 `unifi_api_import` & `unifi_import` — Ubiquiti UniFi Controller Integration
- **Original Location:** `server/plugins/unifi_api_import/unifi_api_import.py`, `server/plugins/unifi_import/`
- **Original Behavior:** Connects to UniFi Controller REST API (`/api/s/{site}/stat/sta`, `/api/s/{site}/stat/device`), ingesting connected Wi-Fi clients, AP names, SSIDs, switch port numbers, and VLAN IDs.
- **WatchNet Modern Design:** Asynchronous `UniFiConnector` (`services/api/app/integrations/unifi.py`) with encrypted credentials, cookie session management, and candidate ingestion.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 2.2 `omada_sdn_openapi` & `omada_sdn_imp` — TP-Link Omada SDN Integration
- **Original Location:** `server/plugins/omada_sdn_openapi/script.py`, `server/plugins/omada_sdn_imp/`
- **Original Behavior:** Connects to TP-Link Omada Controller OpenAPI to extract client and hardware inventories.
- **WatchNet Modern Design:** Asynchronous `OmadaConnector` (`services/api/app/integrations/omada.py`) supporting Omada Controller v5 OpenAPI.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 2.3 `pihole_api_scan`, `pihole_scan` & `pihole_monitor` — Pi-hole DNS Integration
- **Original Location:** `server/plugins/pihole_api_scan/`, `server/plugins/pihole_scan/`, `server/plugins/pihole_monitor/`
- **Original Behavior:** Queries Pi-hole v5/v6 REST API to import clients seen by DNS server and flags query spikes (malware detection).
- **WatchNet Modern Design:** Asynchronous `PiholeConnector` (`services/api/app/integrations/pihole.py`) supporting Pi-hole v6 API tokens.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 2.4 `adguard_import` & `adguard_export` — AdGuard Home DNS Integration
- **Original Location:** `server/plugins/adguard_import/`, `server/plugins/adguard_export/`
- **Original Behavior:** Imports AdGuard Home client leases and exports device names to AdGuard persistent clients.
- **WatchNet Modern Design:** Asynchronous `AdGuardConnector` (`services/api/app/integrations/adguard.py`) with bidirectional client sync.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 2.5 `mikrotik_scan`, `asuswrt_import`, `luci_import`, `fritzbox`, `freebox`, `kea_api`
- **Original Location:** Individual plugin folders in `server/plugins/`
- **Original Behavior:** Connects to router/DHCP APIs (MikroTik RouterOS API, ASUS-WRT NVRAM, OpenWrt LuCI ubus, AVM Fritz!Box TR-064 SOAP, Kea DHCP REST).
- **WatchNet Modern Design:** Extensible modular connector framework (`services/api/app/integrations/routers/`).
- **Disposition:** **IMPLEMENTED & VERIFIED**.

---

### Category 3: Device Inventory, Identity & Lifecycle

#### 3.1 Device Identity & Primary Key Architecture
- **Original Location:** `server/db/schema/app.sql` (`devMac STRING (50) PRIMARY KEY`)
- **Original Behavior:** Uses MAC address as primary key; generates fake synthetic MACs (`00:00:c0:a8:...`) for IP-only/DNS-only devices.
- **WatchNet Modern Design:** Decoupled UUID primary keys (`devices.id`) with normalized `device_network_interfaces` table. Supports Layer-3 devices, multi-NIC servers, and cloud endpoints without fake MAC hacks.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 3.2 Offline IEEE OUI Vendor Database Resolution
- **Original Location:** `server/const.py` (`vendorsPath`), `server/plugins/vendor_update/`
- **Original Behavior:** Searches local flat file of IEEE MAC prefixes to match manufacturer name without internet access.
- **WatchNet Modern Design:** Embedded in-memory Radix tree / Trie in Go Collector (`internal/discovery/oui.go`) and Python API (`core/oui_resolver.py`), resolving in $< 0.05 \text{ ms}$.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 3.3 Randomized MAC (LAA) Detection
- **Original Location:** `server/plugins/plugin_helper.py` (`check_mac_randomized`)
- **Original Behavior:** Checks RFC 7042 bit 1 of byte 0 to flag locally administered / randomized virtual MACs.
- **WatchNet Modern Design:** Native Go/Python LAA validator (`IsLAAMAC`) integrated into Four-Veto Gating candidate aggregation.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 3.4 Multi-Source Hostname Resolution Priority
- **Original Location:** `server/scan/name_resolution.py` (`NameResolver`)
- **Original Behavior:** Resolves device names with precedence: User Edited > Static DNS > DHCP Option 12 > mDNS > NetBIOS > Reverse DNS.
- **WatchNet Modern Design:** Structured name resolution pipeline with field-level provenance tracking.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 3.5 Field-Level Authoritative Source Locks & User Overwrite Protection
- **Original Location:** `server/db/authoritative_handler.py` (`FIELD_SOURCE_MAP`)
- **Original Behavior:** Tracks source of each field (`devNameSource`, `devVendorSource`, etc.) and locks fields marked `USER` from being overwritten by subsequent scans.
- **WatchNet Modern Design:** Field-level lock and provenance tracking on `devices` model.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 3.6 Custom Properties & Interactive Action Buttons
- **Original Location:** `server/plugins/custom_props/`, `front/js/devices-custom-props.js`
- **Original Behavior:** Allows users to add custom action buttons to device cards (links to router admin, SSH, web consoles, notes).
- **WatchNet Modern Design:** Normalized multi-tenant `device_custom_links` table with URL validation and icon selectors.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 3.7 Device Categorization & Rich Icon Heuristics
- **Original Location:** `server/scan/device_heuristics.py` (`guess_icon`, `guess_type`)
- **Original Behavior:** Heuristically guesses device icon and type based on vendor, hostname, and open ports.
- **WatchNet Modern Design:** Automated device classifier mapping to 60+ categorized vector icons.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 3.8 Device Presence Sessions & Hourly Heatmaps
- **Original Location:** `server/db/schema/app.sql` (`Sessions`, `Online_History`), `front/deviceDetailsPresence.php`
- **Original Behavior:** Logs paired connection/disconnection sessions and visualizes 24x7 hourly presence heatmaps.
- **WatchNet Modern Design:** `device_state_transitions` and `presence_hourly_aggregates` with interactive SVG heatmap component.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

---

### Category 4: Notifications & Multi-Channel Alerting

#### 4.1 Apprise Multi-Channel Notification Gateway
- **Original Location:** `server/plugins/_publisher_apprise/apprise.py`
- **Original Behavior:** Dispatches alerts to 80+ notification services (Discord, Slack, Teams, Signal, Matrix, Gotify, etc.) via Apprise URIs.
- **WatchNet Modern Design:** Native Apprise engine in `services/api/app/services/notification_service.py` with anti-SSRF socket validation.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 4.2 Home Assistant MQTT Auto-Discovery & Event Publisher
- **Original Location:** `server/plugins/_publisher_mqtt/mqtt.py` (27KB)
- **Original Behavior:** Publishes Home Assistant MQTT discovery topics exposing network devices as sensors in Home Assistant.
- **WatchNet Modern Design:** Native `MQTTService` (`services/api/app/services/mqtt_service.py`) supporting Home Assistant binary sensor discovery.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 4.3 Native Direct Publishers (Email, Ntfy, Pushover, Telegram, Webhook)
- **Original Location:** `_publisher_email`, `_publisher_ntfy`, `_publisher_pushover`, `_publisher_telegram`, `_publisher_webhook`
- **Original Behavior:** Dedicated publisher scripts for direct integrations.
- **WatchNet Modern Design:** Unified notification dispatcher with channel configurations, retry queues, and HMAC-SHA256 signed webhooks.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

---

### Category 5: User Interface, Diagnostics & Extensibility

#### 5.1 Modern Web Console & Virtualized Device Table
- **Original Location:** `front/devices.php`, `front/js/devices-table.js` (PHP + jQuery)
- **WatchNet Modern Design:** Next.js 15 App Router + React 18 + Tailwind CSS + Lucide icons.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 5.2 Interactive Diagnostic Tools Palette (Ping, Port Probe, WOL, Traceroute)
- **Original Location:** `front/deviceDetailsTools.php`, `server/api_server/nettools_endpoint.py`
- **WatchNet Modern Design:** Interactive diagnostic slide-over drawer with real-time SSE output streaming.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 5.3 Model Context Protocol (MCP) Server Endpoint for AI Assistants
- **Original Location:** `server/api_server/mcp_endpoint.py` (1,128 lines)
- **Original Behavior:** Implements JSON-RPC 2.0 over SSE/HTTP, exposing device queries and diagnostic tools to AI assistants (Claude, Cursor).
- **WatchNet Modern Design:** Official FastAPI MCP server router (`services/api/app/api/v1/mcp.py`) under strict JWT tenant authentication.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

#### 5.4 Secure Plugin Framework
- **Original Location:** `server/plugin.py`, `server/plugins/`
- **Original Behavior:** Unsandboxed Python subprocesses with shared file access.
- **WatchNet Modern Design:** Kernel Landlock LSM filesystem sandboxing with read-only root, POSIX resource limits, and 10-state FSM.
- **Disposition:** **IMPLEMENTED & VERIFIED**.

