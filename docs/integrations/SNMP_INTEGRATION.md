# WatchNet SNMP Integration Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Supported Protocols:** SNMPv2c (Community String) and SNMPv3 (USM AuthPriv / SHA-256 + AES-128/256)  
**Applicability:** Managed Switches, Enterprise APs, Routers, NAS, Printers  

---

## 1. Architectural Scope & Discovery Mechanism

The WatchNet SNMP integration module queries managed network infrastructure to collect hardware metrics, interface counters, and layer-2 forwarding (bridge) tables:
1. **Device Identification & SysInfo:** Queries `SNMPv2-MIB::system` (`sysDescr`, `sysObjectID`, `sysUpTime`, `sysName`, `sysLocation`).
2. **Interface Statistics & Link State:** Queries `IF-MIB::ifTable` and `ifXTable` for port names, operational status, MTU, speed, and 64-bit byte counters (`ifHCInOctets`, `ifHCOutOctets`).
3. **Bridge Forwarding Database (FDB / MAC-to-Port Correlation):** Walks `BRIDGE-MIB::dot1dTpFdbTable` and `Q-BRIDGE-MIB::dot1qTpFdbTable` to discover which physical switch port hosts each client MAC address.

```mermaid
flowchart TD
    WN[WatchNet Collector Daemon] -->|SNMP Get/Walk| SW[Managed Switch / Router]
    SW -->|sysDescr, sysName| WN
    SW -->|ifTable / ifXTable| WN
    SW -->|dot1dTpFdbTable (MAC -> Port)| WN
    WN -->|Ingest Topology| DB[(WatchNet Database)]
```

---

## 2. Standard MIBs & OID Catalog

| MIB Name | OID Prefix | Information Extracted |
|---|---|---|
| `SNMPv2-MIB::sysDescr` | `1.3.6.1.2.1.1.1` | OS version, hardware model, vendor build |
| `SNMPv2-MIB::sysUpTime` | `1.3.6.1.2.1.1.3` | Uptime in hundredths of a second |
| `IF-MIB::ifDescr` | `1.3.6.1.2.1.2.2.1.2` | Interface description (e.g., `GigabitEthernet1/0/1`) |
| `IF-MIB::ifOperStatus` | `1.3.6.1.2.1.2.2.1.8` | Port status (1=Up, 2=Down, 3=Testing) |
| `IF-MIB::ifHighSpeed` | `1.3.6.1.2.1.31.1.1.1.15` | Port speed in Mbps (1000, 2500, 10000) |
| `IF-MIB::ifHCInOctets` | `1.3.6.1.2.1.31.1.1.1.6` | 64-bit ingress byte counter |
| `IF-MIB::ifHCOutOctets` | `1.3.6.1.2.1.31.1.1.1.10` | 64-bit egress byte counter |
| `BRIDGE-MIB::dot1dTpFdbAddress` | `1.3.6.1.2.1.17.4.3.1.1` | MAC address learned on bridge |
| `BRIDGE-MIB::dot1dTpFdbPort` | `1.3.6.1.2.1.17.4.3.1.2` | Port index mapped to learned MAC |

---

## 3. High-Performance Asynchronous SNMP Engine

The Go Collector implements an asynchronous SNMP walker utilizing Go's `gosnmp` library:
- **Non-Blocking Walk:** Uses `BulkWalk` with `maxRepetitions = 25` to minimize packet round-trips over high-latency links.
- **Topology Resolution Pipeline:**
  1. The collector walks `dot1dTpFdbPort` to produce a map: `MAC Address -> Bridge Port Index`.
  2. Resolves `Bridge Port Index` to `ifIndex` using `dot1dBasePortIfIndex`.
  3. Resolves `ifIndex` to human-readable interface name (`ifDescr` / `ifName`).
  4. Delivers the normalized topology records to `/api/v1/discovery/ingest`.

---

## 4. Configuration Schema

```json
{
  "integration_type": "snmp",
  "site_id": "site_01hw8v3m4q2",
  "name": "Core Switch 24-Port",
  "target_host": "192.168.1.10",
  "snmp_version": "v3",
  "port": 161,
  "timeout_milliseconds": 2000,
  "retries": 2,
  "community": null,
  "v3_credentials": {
    "security_level": "authPriv",
    "username": "snmp_admin",
    "auth_protocol": "SHA256",
    "auth_password": "secret:vault:enc:snmp_auth",
    "priv_protocol": "AES256",
    "priv_password": "secret:vault:enc:snmp_priv"
  },
  "collect_interface_metrics": true,
  "collect_bridge_fdb": true,
  "poll_interval_seconds": 120
}
```

---

## 5. Security & Network Constraints

- **Community Strings & Credentials:** Default community string `public` is strongly discouraged and triggers an automated UI security recommendation. All SNMPv3 passphrases are encrypted at rest with AES-256-GCM.
- **CPU Protection on Target Switches:** Large switches can experience CPU spikes if queried excessively. WatchNet enforces a minimum 60-second polling interval and bounds concurrency to 5 simultaneous SNMP walkers per target.
