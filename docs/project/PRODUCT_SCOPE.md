# WatchNet Product Scope Specification

**Document Version:** 1.0.0  
**Baseline:** NetAlertX v25.11.29+ Parity Rebuild  

---

## 1. In-Scope Product Capabilities

### 1.1 Complete NetAlertX Re-implementation
- Layer-2 and Layer-3 discovery engines (ARP, NDP, ICMP, fping, nmap, ip neigh).
- Active and passive hostname discovery (DNS PTR, mDNS Avahi, NetBIOS, custom templates).
- Comprehensive device inventory management, device detail cards, presence heatmaps, and session tracking.
- Multi-channel notification pipeline (Apprise, Telegram, Discord, Pushbullet, Pushover, NTFY, Email, Webhooks).
- Full suite of 56 upstream plugin integrations (including router configs, speedtest, rogue DHCP detection, DDNS).
- Workflow automation engine for triggered actions.
- CSV/JSON backup and restore utilities.

### 1.2 WatchNet Modern Architectural Additions
- Decoupled Go collector service with least-privilege capability execution.
- Hardware-agnostic BaseRouterAdapter architecture supporting OpenWrt, AsusWRT, FRITZ!Box, MikroTik, and UniFi.
- Transparent parental controls and DNS policy orchestration via AdGuard Home and Pi-hole.
- Next.js 15 App Router web application with high-density data tables and real-time SSE updates.
- PostgreSQL 16+ relational schema with time-series partition pruning.
- Multi-site remote collector architecture connecting distributed LAN probes to a centralized hub.

---

## 2. Explicit Out-of-Scope Capabilities

- **Deep Packet Inspection (DPI) & TLS Interception**: WatchNet does not perform TLS decryption, MITM SSL certificate proxying, or packet payload content inspection.
- **Kernel-Level Firewall Enforcement**: WatchNet delegates firewall blocking and IP/MAC filtering to the local router adapter or DNS filter, rather than attempting to act as an inline hardware bridge.
- **Commercial Cloud SaaS Dependency**: WatchNet is strictly self-hosted; no operational telemetry or customer network metadata is phoned home.
- **PHP Legacy Compatibility**: WatchNet does not provide an execution runtime for legacy PHP scripts.
