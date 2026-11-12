# WatchNet Known Technical Limitations

**Document Version:** 1.0.0  
**Classification:** Engineering Constraints & Documented Caveats  

---

## 1. Parental Controls & DNS Filtering Limitations

### 1.1 Encrypted DNS Protocols (DoH / DoT / DoQ)
- **Limitation**: Devices utilizing private DNS, DNS-over-HTTPS (DoH), DNS-over-TLS (DoT), or Apple iCloud Private Relay bypass local DNS servers.
- **Impact**: Domain-level parental control filtering cannot inspect or block queries directed to encrypted third-party resolvers (e.g. Cloudflare 1.1.1.1, Google 8.8.8.8) unless router-level port blocking (TCP/UDP 853 and known DoH IP addresses) is active.
- **Mitigation**: Documented router firewall configuration guides to drop outbound port 853 and block well-known DoH bootstrap IPs.

### 1.2 Virtual Private Networks (VPNs)
- **Limitation**: Devices running commercial VPN tunnels encrypt all traffic at the operating system level, bypassing local gateway routing and DNS inspection.
- **Impact**: WatchNet can detect that the device is connected to the network, but cannot inspect or restrict domains accessed inside an active VPN tunnel.

---

## 2. Network Discovery & Layer-2 Constraints

### 2.1 MAC Address Randomization
- **Limitation**: Modern mobile operating systems (iOS, Android, Windows 11) default to randomized MAC addresses per SSID.
- **Impact**: If a device rotates its MAC address, it may register as a new device unless recognized by hostname or static IP lease.
- **Mitigation**: WatchNet inspects the IEEE 802 locally administered address bit and flags randomized MACs, allowing administrators to group them under a single user profile.

### 2.2 Cross-Subnet / Routed VLAN Broadcasts
- **Limitation**: Layer-2 ARP broadcasts do not traverse layer-3 routers or firewalls without DHCP relay / IP helper configurations.
- **Impact**: In multi-VLAN environments, an ARP collector on VLAN 10 cannot discover devices on VLAN 20 without router integration or remote collectors.
- **Mitigation**: Deploy WatchNet remote Go collectors on each VLAN or ingest ARP/DHCP tables directly via router adapters.
