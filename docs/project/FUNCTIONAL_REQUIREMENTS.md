# WatchNet Functional Requirements Specification

**Document Version:** 1.0.0  
**Traceability:** Master Project Directive Section 5  

---

## 1. Network Discovery & Inventory Requirements (FR-DISC)

- **FR-DISC-01 (ARP Scanning)**: The system shall perform high-speed active Layer-2 ARP requests across configured IPv4 subnets using raw sockets.
- **FR-DISC-02 (IPv6 NDP Discovery)**: The system shall discover IPv6 devices via Neighbor Discovery Protocol (NDP) and router advertisement parsing.
- **FR-DISC-03 (ICMP Sweep)**: The system shall execute active ICMP echo requests (fping) across subnets with configurable batch sizes and timeout intervals.
- **FR-DISC-04 (Passive Sniffing)**: The system shall capture broadcast and multicast traffic (mDNS, NetBIOS, DHCP discover) to identify devices passively.
- **FR-DISC-05 (DHCP Lease Parsing)**: The system shall ingest DHCP lease files from local filesystems (dnsmasq.leases, dhcpd.leases) and Kea DHCP API.
- **FR-DISC-06 (SNMP Discovery)**: The system shall poll network switches and routers via SNMP v2c/v3 for ARP tables (ipNetToMediaTable), interfaces, and system MIBs.
- **FR-DISC-07 (Router Integration)**: The system shall poll supported routers (OpenWrt, AsusWRT, FRITZ!Box, MikroTik, UniFi, Omada) for live wireless and wired client lists.
- **FR-DISC-08 (Name Resolution)**: The system shall resolve hostnames using reverse DNS PTR queries, mDNS (Avahi), NetBIOS (nbtscan), and WatchNet template lookups.

---

## 2. Device Management & State Lifecycle (FR-DEV)

- **FR-DEV-01 (Identity Model)**: Every device shall maintain MAC address, current and historical IPv4/IPv6 addresses, hostname, vendor (OUI), category, and custom name.
- **FR-DEV-02 (Presence History)**: The system shall compute and persist 24-hour hourly presence bitmaps and historical connection sessions (start time, end time, total connected duration).
- **FR-DEV-03 (MAC Randomization Detection)**: The system shall analyze the IEEE 802 locally administered address bit (bit 1 of first byte) to flag randomized MACs.
- **FR-DEV-04 (Field Locking)**: Administrators shall be able to lock specific fields (e.g., custom name, device type) to prevent automatic scan overwrite.
- **FR-DEV-05 (Custom Properties)**: The system shall allow arbitrary key-value metadata and schema extensions to be associated with any device.
- **FR-DEV-06 (Archiving & Grouping)**: Devices can be tagged, assigned to household profiles, grouped by network zone, or soft-deleted/archived.

---

## 3. Alerts, Workflows & Notifications (FR-NOTIF)

- **FR-NOTIF-01 (Event Detection)**: The system shall generate events for: New Device Detected, Device Reconnected, Device Disconnected, IP Address Changed, MAC Address Changed, Rogue DHCP Server Detected, Down/Offline Threshold Exceeded.
- **FR-NOTIF-02 (Multi-Channel Dispatch)**: The system shall dispatch formatted notifications to Apprise, Telegram, Discord, Pushbullet, Pushover, NTFY, Webhooks, and SMTP Email.
- **FR-NOTIF-03 (Workflow Engine)**: The system shall evaluate trigger conditions and execute automated actions.

---

## 4. Parental Controls & DNS Policy Orchestration (FR-PC)

- **FR-PC-01 (Profile Association)**: Administrators shall be able to assign devices to family member profiles.
- **FR-PC-02 (DNS Filter Adapter)**: The system shall interact with AdGuard Home and Pi-hole APIs to enforce per-client blocking rules and content restrictions.
- **FR-PC-03 (Bedtime Schedules)**: The system shall allow automated activation and deactivation of internet access / DNS resolution according to scheduled time windows.
- **FR-PC-04 (Graceful Degradation)**: Disconnection or timeout of the DNS filter API must not halt or degrade Layer-2/Layer-3 network discovery.
