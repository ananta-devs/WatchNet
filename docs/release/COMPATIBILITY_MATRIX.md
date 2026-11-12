# WatchNet Hardware & Software Compatibility Matrix — v1.0.0-rc.1

**Product:** WatchNet Enterprise Network Intelligence & Monitoring  
**Release Tag:** `v1.0.0-rc.1`  
**Date:** November 12, 2026  

---

## 1. Supported Operating Systems & Host Environments

| Operating System | Architecture | Supported Runtime | Status | Notes |
|:---|:---:|:---:|:---:|:---|
| **Ubuntu Linux 22.04 / 24.04 LTS** | `amd64`, `arm64` | Docker Compose 2.20+ | **Tier 1 (Recommended)** | Full host networking, raw socket ARP, production standard |
| **Debian Linux 11 / 12** | `amd64`, `arm64` | Docker Compose 2.20+ | **Tier 1** | Native kernel packet capture support |
| **Alpine Linux 3.19+** | `amd64` | Docker Engine | **Tier 1** | Base container image for backend/proxy |
| **macOS 13+ (Ventura / Sonoma)** | `arm64` (Apple Silicon) | Docker Desktop / OrbStack | **Tier 2** | Collector requires host port binding or native binary |
| **Windows 11 (22H2 / 23H2 / 24H2)** | `amd64` | WSL2 Docker / Native Go | **Tier 2** | Native Go collector runs directly against physical LAN adapter |

---

## 2. Router & Gateway Integration Matrix

| Router Platform / Vendor | Communication Protocol | Supported Telemetry | Integration Level | Tested Hardware / Version |
|:---|:---|:---|:---:|:---|
| **Ubiquiti UniFi** | UniFi OS / Controller REST API | Stations, Wi-Fi RSSI, Band, TX/RX, DHCP leases | `full_api` | UniFi Network Application v7.x/v8.x |
| **TP-Link Omada SDN** | Omada OpenAPI v2 | Client list, signal quality, AP association | `full_api` | Omada Software Controller v5.x |
| **OpenWrt / LEDE** | LuCI JSON-RPC / ubus | Connected clients, DHCP leases, wireless signal | `read_only_api` | OpenWrt 21.02, 22.03, 23.05 |
| **AVM FRITZ!Box** | TR-064 SOAP / HTTP | Host entries, IP/MAC mappings, online status | `read_only_api` | FRITZ!OS 7.x+ |
| **ASUSWRT / Merlin** | SSH (dnsmasq / `wl assoclist`) | Wireless associations, DHCP leases | `read_only_api` | ASUSWRT-Merlin 386.x / 388.x |
| **MikroTik RouterOS** | RouterOS v7 REST API / SSH | DHCP server leases, registration tables | `read_only_api` | RouterOS v7.1+ |
| **TP-Link Consumer (Stock)** | L2 ARP / ICMP / DNS PTR | Availability, MAC vendor, neighbor tables | `unsupported` (Direct API) / `passive_discovery` | TL-WR841N v14 (`INCLUDE_LOGIN_GDPR_ENCRYPT=1`) |
| **Generic Linux Gateway** | ISC dhcpd / Kea / dnsmasq files | DHCP lease parsing, arp cache | `read_only_api` | dnsmasq 2.8x, Kea 2.x |

---

## 3. Managed DNS Resolver Matrix (Family Safety & Filtering)

| DNS Resolver | Integration Method | Capabilities Supported | Verification Status |
|:---|:---|:---|:---:|
| **AdGuard Home** | REST API (`/control/...`) | Query log ingestion, domain blocking, parental control categories, safe search | **Fully Verified** |
| **Pi-hole v5 / v6** | REST API / PHP & SQLite FTL | Query activity streaming, gravity blocklists, client lease sync | **Fully Verified** |
| **Generic Local DNS** | System Resolver / DNS PTR queries | Reverse IP-to-hostname lookups | **Fully Verified** |

---

## 4. Notification Publisher Integrations

| Channel / Publisher | Protocol | Features Supported |
|:---|:---|:---|
| **Apprise** | Apprise CLI / Python Engine | 80+ messaging notification targets |
| **SMTP Email** | STARTTLS / SSL SMTP | MIME formatted alerts, batch dispatch |
| **Telegram** | Bot API (`/sendMessage`) | Instant markdown alerts, chat channels |
| **MQTT** | MQTT v3.1.1 / v5.0 Broker | Home Assistant auto-discovery, telemetry topics |
| **ntfy.sh** | HTTP POST | High-priority push notifications with action tags |
| **Pushover** | Pushover REST API | Priority sound alerts, push tokens |
| **Pushsafer** | Pushsafer REST API | Multi-device client notifications |
| **Generic Webhooks** | HTTP/HTTPS POST | Signed payloads with HMAC-SHA256 headers |
