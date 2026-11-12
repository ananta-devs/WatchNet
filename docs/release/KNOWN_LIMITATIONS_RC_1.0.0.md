# WatchNet Known Limitations — v1.0.0-rc.1

**Product:** WatchNet Enterprise Network Intelligence & Monitoring  
**Release Tag:** `v1.0.0-rc.1`  
**Date:** November 12, 2026  

---

## 1. Hardware & Router Integration Limitations

### 1.1 TP-Link Stock Consumer Firmware Encryption (TL-WR841N v14)
- **Status:** Documented / Transparently Classified as `Unsupported Direct API`.
- **Limitation:** Direct HTTP API polling of client association tables and DHCP lease databases is technically blocked on consumer routers running stock TP-Link firmware with `INCLUDE_LOGIN_GDPR_ENCRYPT=1` (client-side encrypted CGI authentication).
- **Supported Workaround:** WatchNet discovers the router at `192.168.0.1` and all client devices behind it using passive Layer-2 ARP sweeps, ICMP availability checks, DNS PTR resolution, and local subnet neighbor tables. Direct router API polling is intentionally not supported to avoid breaking firmware security mechanisms.

### 1.2 OpenWrt / LuCI Firmware Versions
- LuCI JSON-RPC session token authentication is supported on OpenWrt 19.x, 21.x, 22.x, and 23.x. Custom forks with non-standard RPC paths or strict IP binding require explicit adapter configuration.

### 1.3 ASUSWRT / Merlin
- Wireless client extraction relies on `wl assoclist` or dnsmasq lease table access over SSH. Stock ASUS firmware without SSH enabled must use passive network discovery.

---

## 2. DNS & Parental Control Protocol Boundaries

### 2.1 Encrypted DNS Protocols (DoH / DoT / DoQ)
- **Status:** Fundamental Architecture Constraint.
- **Limitation:** Client devices utilizing external DNS-over-HTTPS (DoH, e.g. Cloudflare 1.1.1.1, Google 8.8.8.8) or DNS-over-TLS (DoT, port 853) that bypass the local LAN resolver cannot be filtered or logged by WatchNet's AdGuard Home / Pi-hole integration.
- **Recommended Network Mitigation:** Network administrators should block outgoing TCP/UDP port 853 and drop known public DoH IP addresses at the perimeter gateway firewall to force clients to use the local managed resolver.

### 2.2 Virtual Private Networks (VPNs) and Private Relay
- Apple iCloud Private Relay, corporate VPNs, and third-party consumer VPNs route traffic through encrypted tunnels, bypassing local DNS queries and L3 inspection.

---

## 3. Network Discovery & Operating System Telemetry

### 3.1 Network Availability vs. Operating System Uptime
- **Clarification:** WatchNet tracks **Observed Network Availability Duration** based on continuous ARP and ICMP heartbeats. This metric must **not** be confused with actual device operating-system uptime. Sleeping hosts that maintain Wi-Fi low-power DTIM association may appear continuously available even when idle.

### 3.2 Randomized MAC Addresses (RFC 7042 LAA)
- Modern mobile operating systems (iOS 14+, Android 10+, Windows 11) generate randomized MAC addresses by default per SSID. WatchNet identifies these devices using the IEEE RFC 7042 Locally Administered Address (LAA) bit and provides fingerprinting to correlate devices, but cannot prevent clients from cycling MAC addresses if configured by the user.

---

## 4. Container & Operating System Deployment Constraints

### 4.1 Host Networking on Non-Linux Docker Hosts
- Docker Desktop on Windows and macOS runs inside a virtualized Linux VM. The `network_mode: "host"` directive binds to the VM's internal virtual network rather than the physical host's LAN adapter.
- For physical Layer-2 broadcast discovery on Windows, run the standalone Go collector binary (`collector/cmd/collector/main.go`) directly on the Windows host.
