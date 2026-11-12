# NetAlertX Complete Feature Inventory

**Document Version:** 1.0.0  
**Baseline Snapshot:** `D:\NetAlertX-Reference-Snapshot`  
**Target:** WatchNet Architectural Parity  

---

## 1. Inventory Summary

NetAlertX encompasses core network monitoring capabilities distributed across its web UI, core daemon, and 56 modular plugins. All features are cataloged below with their functional domain and parity status in WatchNet.

---

## 2. Core Functional Capabilities

### 2.1 Device Discovery & Inventory
- **ARP Sweep Discovery**: Layer-2 discovery mapping MAC addresses to local IP addresses.
- **Active ICMP Ping Sweep**: Layer-3 reachability and latency checks across configured subnets.
- **Passive Packet Sniffing**: Continuous monitoring of broadcast traffic and ARP requests.
- **Neighbor Table Inspection**: Dynamic querying of kernel ARP and neighbor cache tables.
- **Port & Service Fingerprinting**: Identification of open TCP/UDP ports and service banners.
- **Hardware Vendor Resolution**: MAC OUI matching against IEEE vendor registries.
- **Reverse DNS & mDNS Name Resolution**: Hostname resolution using local DNS PTR queries and Zeroconf.

### 2.2 Device Management & Intelligence
- **Device Lifecycle Tracking**: Tracking first seen, last seen, connection durations, and presence history.
- **Device Customization**: User-defined device names, types, icons, owners, locations, and custom properties.
- **New Device Alerting**: Immediate alert triggers when unknown MAC addresses join the network.
- **Connection Sessions**: Historical logging of connect/disconnect intervals and uptime graphs.
- **Presence Heatmap**: Hourly and daily visualization of device network activity.

### 2.3 Router & Infrastructure Integrations
- **UniFi Controller Sync**: Extraction of wireless clients, AP associations, and switch port mappings.
- **TP-Link Omada SDN**: Multi-site client and network device inventory sync via OpenAPI.
- **AsusWRT & OpenWrt**: Client lease retrieval via SSH, NVRAM, or LuCI JSON-RPC.
- **AVM FRITZ!Box**: TR-064 SOAP protocol client monitoring and status checks.
- **DHCP Server Monitors**: Rogue DHCP server detection and lease log file parsing (`dnsmasq`, `kea`, `dhcpd`).

### 2.4 DNS & Parental Control Monitoring
- **Pi-hole Integration**: Query statistics, client list import, and blocking status toggles.
- **AdGuard Home Integration**: DNS query analytics and static DNS rewrite synchronization.

### 2.5 Security & Observability
- **Synthetic Website Monitoring**: HTTP/HTTPS status ping, response time tracking, and SSL certificate expiry warnings.
- **Internet WAN & Speed Monitoring**: External IP change detection and automated bandwidth speedtests.
- **Multi-Channel Notifications**: Push notifications via Discord, Telegram, Pushover, Apprise, Webhooks, and Email.
- **Multi-Site Synchronization**: Aggregation of remote network collector instances into a central dashboard.
