# WatchNet Architecture: Gateway Routers & Hardware Telemetry

## 1. Executive Summary & Capabilities
The **Routers & Gateway Telemetry Subsystem** bridges the gap between passive endpoint packet sniffing and authoritative hardware routing state. It interfaces with commercial, enterprise, and open-source network gateways:
1. **OpenWrt / LuCI Gateways**: REST API, `ubus` RPC, and SSH command execution.
2. **UniFi Dream Machine (UDM/USG)**: UniFi OS API authentication (`/api/auth/login`), real-time wireless client associations, RSSI dBm, and TX/RX link rates.
3. **MikroTik RouterOS**: RouterOS REST API (`/rest/ip/dhcp-server/lease`) and interface stats.
4. **Proprietary Consumer Gateways (e.g. TP-Link TL-WR841N)**: Supported under **`PASSIVE_DISCOVERY`** mode—monitoring Layer-2 ARP ingestion and continuous ICMP reachability without triggering firmware lockouts.

---

## 2. Integration Levels & Gateway State Machine

```mermaid
classDiagram
    class RouterGateway {
        +UUID id
        +string name
        +string vendor
        +string host
        +int port
        +string integration_level
        +boolean is_active
        +int client_count
        +test_connection()
        +sync_clients()
    }

    class TelemetryProfile {
        +boolean passive_arp
        +boolean icmp_reachability
        +boolean dhcp_lease_ingestion
        +boolean wifi_association_rssi
        +boolean snmp_interface_tables
    }

    class RouterClient {
        +string mac
        +string ip
        +string hostname
        +string connection_type
        +string band
        +int rssi
        +float tx_rate
        +float rx_rate
    }

    RouterGateway --> TelemetryProfile
    RouterGateway --> RouterClient : tracks
```

---

## 3. Integration Level Taxonomy

```mermaid
flowchart TD
    GATEWAY{"Target Router Hardware"}
    
    GATEWAY -->|UniFi Controller / UDM| L1["Full API Control<br/>• WiFi RSSI (-58 dBm)<br/>• 2.4/5GHz Band Steering<br/>• Kick / Block Client<br/>• DHCP Ingestion"]
    GATEWAY -->|OpenWrt ubus / REST| L2["Read/Write API<br/>• DHCP Lease Parsing<br/>• Wireless Station Dump<br/>• Firewall Rules"]
    GATEWAY -->|MikroTik RouterOS| L3["REST Interface<br/>• Lease Tables<br/>• ARP Cache<br/>• Interface Bandwidth"]
    GATEWAY -->|Consumer / Locked Firmware<br/>e.g. TP-Link WR841N| L4["PASSIVE_DISCOVERY<br/>• Layer-2 ARP Cache Poll<br/>• Subnet Ping Sweep<br/>• Zero Firmware Lockout"]
```

---

## 4. Sequence: Router Client Sync & RSSI Ingestion

```mermaid
sequenceDiagram
    autonumber
    participant Engine as WatchNet Router Sync Engine
    participant Gateway as Physical Gateway (192.168.0.1)
    participant DB as PostgreSQL 16
    participant UI as Routers Management UI (/routers)

    Engine->>Gateway: Authenticate / Probe API
    alt Proprietary Firmware (TL-WR841N)
        Engine->>Engine: Run PASSIVE_DISCOVERY ARP Sweep
        Engine->>DB: Update Router active status & client count
    else OpenWrt / UniFi
        Engine->>Gateway: GET /api/s/default/stat/sta (Clients)
        Gateway-->>Engine: JSON Station List (MAC, RSSI, Band, Tx/Rx)
        Engine->>DB: Bulk Upsert router clients & RSSI signals
    end
    UI->>DB: GET /api/v1/routers & /api/v1/routers/{id}/clients
    DB-->>UI: Connected clients list with signal bars
    UI->>UI: Render Client Association Table with Signal Gauges
```

---

## 5. Database Schema (`routers` table)
```sql
CREATE TABLE routers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    vendor VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    firmware VARCHAR(100),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 80,
    username VARCHAR(100),
    password_encrypted TEXT,
    integration_level VARCHAR(50) NOT NULL DEFAULT 'read_only_api',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_connected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```
