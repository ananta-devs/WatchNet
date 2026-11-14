# WatchNet Complete Plugin Inventory

**Document Version:** 1.0.0  
**Baseline Snapshot:** `D:\WatchNet-Reference-Snapshot` (`server/plugins/`)  
**Total Plugins Discovered:** 56  

---

## 1. Complete Catalog of 56 Discovered Plugins

Every plugin audited from the upstream source repository is classified below:

| # | Plugin Name | Category | Primary Function | Upstream Implementation | WatchNet Modern Parity Module |
| :- | :--- | :--- | :--- | :--- | :--- |
| 1 | `adguard_export` | DNS / Filter | Push static hostnames to AdGuard DNS rewrites | Python / REST API | `watchnet-api` AdGuard Provider |
| 2 | `adguard_import` | DNS / Filter | Pull clients & DNS statistics from AdGuard Home | Python / REST API | `watchnet-api` AdGuard Provider |
| 3 | `arp_scan` | Discovery | L2 ARP broadcast subnet discovery | C binary `arp-scan` | `watchnet-collector` (Go ARP Engine) |
| 4 | `asuswrt_import` | Router | Fetch wireless & DHCP clients from AsusWRT | Python / SSH / NVRAM | `watchnet-api` AsusWRT Adapter |
| 5 | `avahi_scan` | Discovery | mDNS / Zeroconf local service browsing | C daemon `avahi-browse` | `watchnet-collector` (Go Zeroconf) |
| 6 | `csv_backup` | Maintenance | Export devices, events, settings to CSV | Python / SQLite query | `watchnet-api` Data Export Service |
| 7 | `custom_props` | Metadata | Attach custom key-value attributes to devices | Python / SQLite schema | `watchnet-api` Extensible JSONB Schema |
| 8 | `db_cleanup` | Maintenance | Prune expired events/sessions and vacuum DB | Python / SQLite VACUUM | PostgreSQL Partition Pruning & pg_cron |
| 9 | `ddns_update` | Network | Dynamic DNS updater for Cloudflare, DuckDNS | Python / HTTP requests | `watchnet-api` DDNS Service |
| 10 | `dhcp_leases` | Network | Parse local dnsmasq/dhcpd lease files | Python / Regex file parse | `watchnet-api` DHCP File Adapter |
| 11 | `dhcp_servers` | Security | Detect rogue DHCP servers on subnet | Python / Scapy / Raw socket | `watchnet-collector` Rogue DHCP Engine |
| 12 | `dig_scan` | Resolution | Reverse DNS PTR lookups | CLI `dig` wrapper | `watchnet-api` Async DNS Resolver |
| 13 | `dockerdisc` | Infrastructure | Discover local Docker containers | Python / Docker socket | `watchnet-api` Docker Discovery Worker |
| 14 | `freebox` | Router | Extract clients from Freebox OS | Python / REST API | `watchnet-api` Freebox Adapter |
| 15 | `fritzbox` | Router | Extract clients via FRITZ!Box TR-064 SOAP | Python / SOAP / HTTP | `watchnet-api` FritzBox Adapter |
| 16 | `icmp_scan` | Discovery | L3 ping sweep host reachability | C binary `fping` wrapper | `watchnet-collector` (Go ICMP Worker) |
| 17 | `internet_ip` | Network | WAN public IP monitoring and change alerts | Python / External IP APIs | `watchnet-api` WAN Monitor Worker |
| 18 | `internet_speedtest`| Diagnostics | Bandwidth & latency measurement | Python `speedtest-cli` | `watchnet-api` Async Speedtest Worker |
| 19 | `ipneigh` | Discovery | Kernel neighbor table lookup | CLI `ip neigh show` wrapper | `watchnet-collector` Netlink Listener |
| 20 | `kea_api` | Network | Query ISC Kea DHCP Control Agent API | Python / REST API | `watchnet-api` Kea DHCP Adapter |
| 21 | `luci_import` | Router | Query OpenWrt LuCI JSON-RPC API | Python / JSON-RPC | `watchnet-api` OpenWrt Adapter |
| 22 | `maintenance` | Maintenance | Rotate logs, delete temporary files | Bash / Python script | `watchnet-api` Background Maintenance Job |
| 23 | `mikrotik_scan` | Router | Query MikroTik RouterOS API/SSH | Python `librouteros` | `watchnet-api` MikroTik Adapter |
| 24 | `nbtscan_scan` | Discovery | NetBIOS Windows name resolution | C binary `nbtscan` | `watchnet-collector` NetBIOS Prober |
| 25 | `newdev_template` | Workflow | Trigger template scripts on new device | Python template renderer | `watchnet-api` Webhook Action Pipeline |
| 26 | `nmap_dev_scan` | Fingerprinting | Deep OS and service fingerprinting | C binary `nmap -O -sV` | `watchnet-api` Fingerprint Engine |
| 27 | `nmap_scan` | Discovery | Quick TCP SYN discovery | C binary `nmap -sn` | `watchnet-collector` Port Prober |
| 28 | `notification_processing`| Alerts | Route alert messages to publishers | Python publisher router | `watchnet-api` Notification Dispatcher |
| 29 | `nslookup_scan` | Resolution | Standard DNS name resolution | CLI `nslookup` wrapper | `watchnet-api` DNS Resolver Pipeline |
| 30 | `omada_sdn_imp` | Router | Deprecated Omada controller client | Python legacy HTTP | Deprecated (Replaced by OpenAPI) |
| 31 | `omada_sdn_openapi`| Router | Modern TP-Link Omada SDN OpenAPI client | Python / REST API | `watchnet-api` Omada Adapter |
| 32 | `pihole_api_scan` | DNS / Filter | Fetch clients & stats from Pi-hole v5/v6 | Python / REST API | `watchnet-api` Pi-hole Adapter |
| 33 | `pihole_monitor` | DNS / Filter | Pi-hole service health and blocker check | Python / REST API | `watchnet-api` Pi-hole Health Prober |
| 34 | `pihole_scan` | DNS / Filter | Direct Pi-hole FTL SQLite database query | Python / SQLite query | `watchnet-api` Pi-hole FTL Adapter |
| 35 | `rest_import` | Integration | Generic REST endpoint device poller | Python / Configurable HTTP | `watchnet-api` Generic Webhook / Poller |
| 36 | `set_password` | Security | Admin password hashing utility | Python / Argon2 / SHA | `watchnet-api` Argon2id Password Service |
| 37 | `snmp_discovery` | Discovery | Query SNMP switches for port mapping | CLI `snmpwalk` wrapper | `watchnet-api` Async PySNMP Engine |
| 38 | `sync` | Multi-Site | Pull remote node SQLite databases | Python / HTTP download | `watchnet-api` mTLS Collector Stream |
| 39 | `ui_settings` | Core | Store UI layout state and column choices | Python / SQLite table | `watchnet-api` User Preferences API |
| 40 | `unifi_api_import`| Router | Query Ubiquiti UniFi Network Controller | Python / REST API | `watchnet-api` UniFi Adapter |
| 41 | `wake_on_lan` | Management | Send Wake-on-LAN magic packet | Python / UDP socket | `watchnet-api` WoL Broadcast Service |
| 42 | `website_monitor` | Monitoring | Uptime ping and SSL check for external URLs | Python / HTTP requests | `watchnet-api` Synthetic URL Prober |
| 43 | `apcupsd_import` | Hardware | Monitor APC UPS status via apcupsd daemon | Python / NIS socket | `watchnet-api` APC UPS Adapter |
| 44 | `nut_import` | Hardware | Monitor UPS status via Network UPS Tools | Python / PyNUT client | `watchnet-api` NUT Adapter |
| 45 | `mqtt_publisher` | Integration | Publish device status & events to MQTT | Python `paho-mqtt` | `watchnet-api` MQTT Client Worker |
| 46 | `homeassistant` | Integration | Home Assistant MQTT discovery & entity sync | Python / MQTT / REST | `watchnet-api` Home Assistant Bridge |
| 47 | `radius_import` | Security | FreeRADIUS authentication & lease import | Python / Log parse | `watchnet-api` RADIUS Accounting Parser |
| 48 | `wireguard_peer` | Network | WireGuard VPN client and handshake monitor | CLI `wg show` wrapper | `watchnet-api` WireGuard Adapter |
| 49 | `tailscale_dev` | Network | Monitor Tailscale tailnet peer status | CLI `tailscale status` | `watchnet-api` Tailscale API Adapter |
| 50 | `piwigo_backup` | Integration | Specialized photo asset sync | Python script | Deprecated (Generic webhook used) |
| 51 | `speedtest_ookla`| Diagnostics | Official Ookla speedtest binary integration | CLI binary wrapper | `watchnet-api` Speedtest Worker |
| 52 | `apprise_notify` | Alerts | Multi-channel notifications via Apprise | Python `apprise` library | `watchnet-api` Apprise Notification Engine |
| 53 | `telegram_bot` | Alerts | Interactive Telegram two-way bot | Python / Telegram API | `watchnet-api` Telegram Bot Integration |
| 54 | `discord_webhook`| Alerts | Discord rich embed notification dispatcher | Python / Webhook | `watchnet-api` Discord Dispatcher |
| 55 | `ntfy_publisher` | Alerts | High-speed push alerts via ntfy.sh | Python / HTTP POST | `watchnet-api` ntfy Notification Provider |
| 56 | `gotify_publisher`| Alerts | Self-hosted push alerts via Gotify server | Python / REST API | `watchnet-api` Gotify Notification Provider |
