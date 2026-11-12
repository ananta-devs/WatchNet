# WatchNet Multi-Site Architecture

**Document Version:** 1.0.0  
**Topology:** Hub & Spoke Distributed Network Monitoring  
**Security:** Mutual TLS (mTLS) / Encrypted Token Authorization  

---

## 1. Multi-Site Monitoring Model

WatchNet supports monitoring multiple distinct physical locations (e.g. Home, Office, Remote Lab) from a single centralized management dashboard.

```mermaid
graph TD
    subgraph "Central Hub (Main Site)"
        HubUI["WatchNet Web Console"]
        HubAPI["WatchNet Central API"]
        HubDB[("Central PostgreSQL (Multi-Tenant)")]
    end

    subgraph "Remote Site A (Office Subnet)"
        AgentA["WatchNet Remote Collector<br/>(Edge Daemon)"]
        SubnetA["192.168.10.0/24"]
    end

    subgraph "Remote Site B (Branch Subnet)"
        AgentB["WatchNet Remote Collector<br/>(Edge Daemon)"]
        SubnetB["172.16.0.0/24"]
    end

    AgentA -.->|Scan Observations| SubnetA
    AgentB -.->|Scan Observations| SubnetB
    AgentA ==>>|HTTPS / mTLS Egress Stream| HubAPI
    AgentB ==>>|HTTPS / mTLS Egress Stream| HubAPI
    HubAPI --> HubDB
    HubUI <--> HubAPI
```

---

## 2. Remote Edge Agent Ingestion Protocol

1. **Authentication**: Each remote edge collector is provisioned with a cryptographic site token and mTLS client certificate.
2. **Batch Compression**: Remote agents buffer local ARP and ICMP sightings, compress the JSON payload with zstd, and post updates to `/api/v1/collectors/report`.
3. **Network Resiliency**: If WAN connectivity drops, the edge agent queues observations locally in an embedded SQLite buffer and replays them upon reconnection without data loss.
