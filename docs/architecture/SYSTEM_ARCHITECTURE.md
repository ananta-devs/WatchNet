# WatchNet System Architecture

**Document Version:** 1.0.0  
**Status:** Approved Architectural Specification  
**Tech Stack:** Next.js 14, FastAPI, Go Collector, PostgreSQL 16, Redis 7  

---

## 1. High-Level Component Topology

WatchNet is engineered as a decoupled, multi-tier distributed system comprising an isolated Layer-2/3 packet discovery collector, an asynchronous backend application core, enterprise transactional storage, and a modern reactive frontend.

```mermaid
graph TD
    subgraph "Local Area Network"
        Clients[Network Devices / IoT / PCs]
        Router[Default Gateway / Router]
        AP[Wireless Access Points]
    end

    subgraph "Edge Collection Layer (Least Privilege)"
        Collector["watchnet-collector (Go daemon)<br/>• CAP_NET_RAW only<br/>• Non-blocking pcap/ARP<br/>• Zero web exposure"]
    end

    subgraph "Ingestion & Cache"
        Redis[("Redis 7<br/>• Observation Streams<br/>• Pub/Sub Bus<br/>• Celery Task Queue")]
    end

    subgraph "Core Backend Services"
        API["watchnet-api (FastAPI / Python 3.12)<br/>• OpenAPI REST & SSE<br/>• Pydantic v2 Contracts<br/>• Router Adapters<br/>• Egress Proxy Anti-SSRF"]
        Worker["watchnet-worker (Celery / Background Tasks)<br/>• Fingerprinting Engine<br/>• Speedtest Worker<br/>• Notification Dispatcher"]
    end

    subgraph "Data Persistence"
        Postgres[("PostgreSQL 16<br/>• Row-Level Security<br/>• Time-Partitioned Events<br/>• Native JSONB Telemetry")]
    end

    subgraph "Presentation Layer"
        UI["watchnet-ui (Next.js 14 / React Server Components)<br/>• Tailwind CSS v4 + shadcn/ui<br/>• Live SSE / WebSocket Feed"]
        Browser[("User Browser / Admin Console")]
    end

    Clients -.->|ARP / ICMP / mDNS| Collector
    Collector -->|Batch Ingestion (HTTP/mTLS)| Redis
    Redis --> API
    Redis --> Worker
    API --> Postgres
    Worker --> Postgres
    Router <-.->|Read-Only Adapters (SSH/REST)| API
    UI -->|REST & SSE Requests| API
    Browser <--> UI
```

---

## 2. Component Separation & Responsibilities

1. **`watchnet-collector` (Go Engine)**:
   - Operates in container network namespace with `CAP_NET_RAW`.
   - Listens to raw Ethernet packets, handles fast ARP broadcast sweeps, and tracks ICMP echo ping responses.
   - Buffers raw network sightings into memory and flushes batches to Redis streams or the ingestion API.
2. **`watchnet-api` (FastAPI Application Service)**:
   - Exposes authenticated REST endpoints, OpenAPI 3.1 specs, and real-time SSE streams.
   - Executes domain business logic, device identity reconciliation, and router polling adapters.
   - Runs strictly as an unprivileged user (`watchnet:10001`) with egress proxy filtering.
3. **`watchnet-worker` (Asynchronous Celery Engine)**:
   - Handles deferred long-running background tasks (Nmap port checks, internet speedtests, notification dispatch).
4. **`PostgreSQL 16`**:
   - Master persistent store. Implements Row-Level Security (RLS) for tenant separation and range partitioning for presence and event logs.
5. **`Redis 7`**:
   - In-memory event streaming broker, session cache, and Celery broker.
6. **`watchnet-ui` (Next.js 14 Web Application)**:
   - Modern dashboard interface leveraging Tailwind CSS and shadcn/ui with dark/light themes and reactive UI components.
