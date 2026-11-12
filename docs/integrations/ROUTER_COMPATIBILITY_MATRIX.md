# WatchNet Router Compatibility Matrix

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Architecture:** `BaseRouterAdapter` Abstraction Layer  

---

## 1. Overview & Adapter Capabilities

WatchNet interfaces with routers, gateways, and network switches across a wide variety of hardware vendors. Rather than embedding vendor-specific logic into the core engine, WatchNet uses a normalized `BaseRouterAdapter` contract that maps hardware-specific management APIs to uniform WatchNet schemas.

### Capability Definitions:
- **ARP/Neighbor Table:** Query active L2-to-L3 address bindings.
- **DHCP Leases:** Read active static/dynamic DHCP client lease records.
- **Wi-Fi Telemetry:** Signal strength (RSSI), connected BSSID, channel, and PHY rates.
- **Traffic Counters:** Per-interface or per-client bandwidth usage (bytes/packets).
- **DNS / Domain Policy:** Ability to enforce or redirect DNS queries for parental controls.
- **Host Blocking:** L2 MAC filtering or L3 firewall rule insertion to drop client traffic.

---

## 2. Vendor Support & Feature Matrix

| Vendor / Platform | Connection Protocol | ARP/Neighbor | DHCP Leases | Wi-Fi Telemetry | Traffic Counters | DNS Policy | Host Blocking | Support Tier |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Ubiquiti UniFi (UDM, UXG, CloudKey)** | HTTPS REST API | ✅ Yes | ✅ Yes | ✅ Yes (Full) | ✅ Yes | ⚠️ Via AdGuard/Pi-hole | ✅ Firewall Rule | **Tier 1 (Official)** |
| **OpenWrt (LuCI & ubus)** | ubus RPC / SSH | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ dnsmasq/AdGuard | ✅ iptables/nftables | **Tier 1 (Official)** |
| **MikroTik RouterOS (v6 & v7)** | RouterOS REST / API | ✅ Yes | ✅ Yes | ✅ Yes (CAPsMAN) | ✅ Yes | ⚠️ Static DNS/NAT | ✅ IP Firewall | **Tier 1 (Official)** |
| **TP-Link Omada SDN** | Omada Open API | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ External DNS | ✅ ACL Rule | **Tier 1 (Official)** |
| **OPNsense / pfSense** | REST API / XML-RPC | ✅ Yes | ✅ Yes | ❌ N/A | ✅ Yes | ✅ Unbound DNS | ✅ Packet Filter | **Tier 1 (Official)** |
| **ASUSWRT / Merlin** | SSH / nvram dump | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Basic | ⚠️ TrendMicro / Pi-hole | ✅ Parental Lock | **Tier 2 (Community)** |
| **AVM FRITZ!Box** | TR-064 SOAP API | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Static DNS | ✅ Device Profile | **Tier 2 (Community)** |
| **Freebox (FreeboxOS)** | Freebox REST API | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ Fixed | ✅ Access Time | **Tier 2 (Community)** |
| **Generic SNMP Managed Switches** | SNMPv2c / SNMPv3 | ✅ Bridge MIB | ❌ N/A | ❌ N/A | ✅ IF-MIB HC | ❌ N/A | ❌ N/A | **Tier 2 (Standard)** |
| **Generic Dumb Router / AP** | Active ARP / ICMP Sweep | ✅ Active Probe | ❌ N/A | ❌ N/A | ❌ N/A | ❌ N/A | ❌ N/A | **Tier 3 (Universal)** |

---

## 3. Tier Classifications

- **Tier 1 (Official Production):** Full test suites run against mock doubles and hardware labs in CI. Automated credential verification and error handling.
- **Tier 2 (Community Maintained):** Fully specified schemas and tested against reference schema dumps. Maintained with community pull request reviews.
- **Tier 3 (Universal Fallback):** Zero router access required. WatchNet operates in pure passive/active collector mode using raw socket sweeps and ARP snooping.

---

## 4. Architectural Separation of Discovery and Enforcement

In accordance with Section 9 of the Master Directive:
- **Discovery Independence:** The failure or misconfiguration of a router adapter's blocking or DNS enforcement API **never** disables network discovery.
- **Non-Destructive Defaults:** By default, all router adapters are instantiated in **READ-ONLY** mode. Explicit administrator activation is required to enable host blocking or DNS mutations.
