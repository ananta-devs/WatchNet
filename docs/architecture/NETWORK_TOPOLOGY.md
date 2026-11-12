# WatchNet Network Topology Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Engines:** React Flow / SVG Graph Engine, L2 Bridge Table Resolver, UniFi / SNMP Topology Ingest  

---

## 1. Architectural Scope & Physical Correlation

WatchNet automatically constructs and visualizes the physical and logical layer-2 network topology:
1. **Core Backbone Infrastructure:** Identifies gateways, managed switches, and Wi-Fi access points.
2. **Physical Port Binding:** Maps wired client MAC addresses to exact switch port numbers using SNMP Bridge MIB (`dot1dTpFdbTable`) or SDN controller APIs (UniFi, Omada).
3. **Wireless BSSID Association:** Maps Wi-Fi devices to specific Access Points (APs), wireless radios (2.4GHz / 5GHz / 6GHz), and channels with real-time signal strength (RSSI).

```mermaid
graph TD
    GW[Gateway / Router (192.168.1.1)] --> SW1[Core Switch 24-Port (Port 1)]
    SW1 -->|Port 12 (Trunk)| AP1[Hallway AP (U6-Pro)]
    SW1 -->|Port 15 (Trunk)| AP2[Office AP (U6-Mesh)]
    SW1 -->|Port 8 (VLAN 10)| NAS[TrueNAS Core (192.168.1.50)]
    SW1 -->|Port 4 (VLAN 20)| PRN[Office Printer]
    
    AP1 -.->|5GHz Ch 36 (-52 dBm)| LAP[Tester MacBook Pro]
    AP1 -.->|2.4GHz Ch 6 (-68 dBm)| IOT1[Smart Thermostat]
    AP2 -.->|5GHz Ch 149 (-48 dBm)| TAB[Child iPad]
```

---

## 2. L2 Topology Resolution Pipeline

The topology discovery engine executes in three sequential stages:

1. **Infrastructure Discovery:**
   - Detects network switches and APs via SNMP `sysDescr`, LLDP/CDP packets, or controller API integrations.
   - Registers each node in `network_nodes` table.
2. **Forwarding Database (FDB) Walking:**
   - Queries each switch for learned MAC addresses per port index.
   - Prunes uplink trunk ports (ports reporting multiple switches or >20 MAC addresses) to locate edge ports.
3. **Graph Assembly & Link Synthesis:**
   - Correlates client MACs to leaf ports.
   - Generates topology edge records in `network_links`: `(source_node_id, target_node_id, port_number, link_type, speed_mbps)`.

---

## 3. Dynamic Interactive Visualization (React Flow)

In the Next.js frontend (`/topology`):
- **Graph Layout:** Rendered using React Flow with dagre layout algorithm for hierarchical tree structure.
- **Node Badges:** Infrastructure nodes display live CPU, memory, and active client count; client nodes display device icon, custom name, and IP.
- **Signal Quality Indicators:** Wireless links render dashed lines colored dynamically based on RSSI (Green: > -60 dBm, Yellow: -60 to -75 dBm, Red: < -75 dBm).
- **Search & Highlighting:** Searching for an IP or device name highlights the complete upstream physical path back to the gateway.
