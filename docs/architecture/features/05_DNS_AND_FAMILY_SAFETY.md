# WatchNet Architecture: DNS Intelligence & Family Safety

## 1. Executive Summary & Capabilities
The **DNS Intelligence & Family Safety Subsystem** protects connected family devices and young users through policy enforcement, domain filtering, and time-based access control:
1. **Kid Profiles & Device Grouping**: Assign one or more device MAC addresses to a family member profile (e.g. *"Kids Tablet"*, *"Study Laptop"*).
2. **One-Click Internet Pause**: Temporarily halts Internet routing or DNS resolution for specific family member devices with zero impact on adult workstations or IoT systems.
3. **Bedtime & Screen-Time Schedules**: Recurring schedules that automatically enforce internet curfews (e.g. Mon-Fri 21:00 to 07:00).
4. **AdGuard Home / Pi-hole Sync**: Pulls upstream DNS block logs, query analytics, and category filter decisions into WatchNet.

---

## 2. System Architecture & Policy Enforcement Flow

```mermaid
flowchart TD
    subgraph Profiles ["Profile & Policy Configuration"]
        PROF["User Creates Profile (e.g. 'Kids')"]
        DEVS["Assign Device MAC Addresses"]
        SCHED["Set Bedtime Schedule (e.g. 21:00 - 07:00)"]
    end

    subgraph DecisionEngine ["WatchNet Enforcement Engine"]
        TIME_CHECK{"Current Time within Bedtime?"}
        MANUAL_CHECK{"Internet Pause Flag Active?"}
        RULE_GEN["Generate Policy Decision"]
    end

    subgraph Enforcers ["Enforcement Gateways"]
        DNS_GW["AdGuard Home / Pi-hole API<br/>(Block Domain Resolution)"]
        ROUTER_GW["Router Firewall API<br/>(Drop Forwarding Chains)"]
    end

    PROF --> DEVS
    DEVS --> SCHED
    SCHED --> TIME_CHECK
    TIME_CHECK -->|Yes| RULE_GEN
    TIME_CHECK -->|No| MANUAL_CHECK
    MANUAL_CHECK -->|Paused| RULE_GEN
    MANUAL_CHECK -->|Allowed| PASS["Allow Full Access"]
    
    RULE_GEN --> DNS_GW
    RULE_GEN --> ROUTER_GW
```

---

## 3. Database Schema Design

### `family_profiles`
```sql
CREATE TABLE family_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    avatar VARCHAR(50),
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    content_filter_level VARCHAR(50) NOT NULL DEFAULT 'standard',
    bedtime_start VARCHAR(5), -- '21:00'
    bedtime_end VARCHAR(5),   -- '07:00'
    bedtime_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Sun"]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### `profile_devices` (Join Table)
```sql
CREATE TABLE profile_devices (
    profile_id UUID NOT NULL REFERENCES family_profiles(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, device_id)
);
```

---

## 4. Sequence: Schedule Check & Automatic Bedtime Enforcement

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Background Policy Daemon (Every 60s)
    participant DB as PostgreSQL 16
    participant DNS as AdGuard Home / Resolver
    participant Router as Gateway Router
    participant UI as Family Safety UI (/family-safety)

    Cron->>DB: Query all family_profiles with active schedules
    DB-->>Cron: Return profiles, assigned device MACs, and bedtimes
    Cron->>Cron: Compare UTC current time against schedule windows
    alt Time is within Bedtime Window
        Cron->>DNS: Update Client Blocking Tags (MAC -> Restricted)
        Cron->>Router: Apply iptables/nftables DROP rule for target MACs
        Cron->>DB: Log policy event 'Bedtime Enforced'
    else Time is outside Bedtime Window
        Cron->>DNS: Remove Blocking Tags
        Cron->>Router: Remove DROP rules
    end
    UI->>DB: GET /api/v1/family/profiles
    DB-->>UI: Return live profile statuses (Bedtime Active / Paused)
```
