# WatchNet DNS Policy Architecture

**Document Version:** 1.0.0  
**Supported DNS Sinkholes:** AdGuard Home, Pi-hole (v5/v6), Technitium  
**Scope:** Transparent Parental Controls & Browsing Policy Synchronization  

---

## 1. Architectural Scope and Transparency

WatchNet integrates with local DNS sinkholes to provide transparent, consent-based parental controls and domain filtering without intrusive deep packet inspection (DPI) or device tampering.

### 1.1 Invariant Principles
- **Transparency**: All DNS blocking policies and filtering profiles are visible to all users on the network dashboard.
- **Device-Centric Filtering**: Policies are mapped to client device IP/MAC identities through DNS server client configuration APIs.

---

## 2. DNS Sinkhole Integration Topology

```mermaid
graph LR
    subgraph "Clients"
        KidDevice["Protected Family Device<br/>(192.168.1.105)"]
        WorkDevice["Unrestricted Device<br/>(192.168.1.20)"]
    end

    subgraph "Local DNS Infrastructure"
        DNS["AdGuard Home / Pi-hole<br/>• Upstream DNS Resolver<br/>• Custom Blocklists<br/>• Client Group Policies"]
    end

    subgraph "WatchNet Core"
        PolicyEngine["WatchNet Policy Engine<br/>• Scheduled Downtime Rules<br/>• Content Category Toggles<br/>• Sinkhole Sync Adapter"]
    end

    KidDevice -->|Port 53 DNS Queries| DNS
    WorkDevice -->|Port 53 DNS Queries| DNS
    PolicyEngine -->|REST API (Client Config)| DNS
```

---

## 3. DoH, DoT, and VPN Evasion Limitations

DNS-level parental controls have fundamental technical boundaries:
1. **Encrypted DNS (DoH/DoT)**: Clients utilizing public DNS-over-HTTPS (e.g. iCloud Private Relay, Chrome Secure DNS) bypass local port 53 DNS filtering.
2. **VPN Tunnels**: Encrypted VPN connections bypass local DNS resolvers entirely.
3. **Mitigation Strategy**: WatchNet documents firewall recommendations (blocking outbound port 853 and unauthorized outbound port 53) while acknowledging these limitations clearly in `KNOWN_LIMITATIONS.md`.
