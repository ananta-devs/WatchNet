# WatchNet Architecture: Internet Health, Speedtest & Monitoring

## 1. Executive Summary & Capabilities
The **Monitoring Subsystem** tracks continuous WAN reachability, DNS query latencies, bandwidth throughput, and external website uptime. It includes:
1. **Multi-Resolver DNS Latency Benchmarking**: Probes Cloudflare (`1.1.1.1`), Google (`8.8.8.8`), and Quad9 (`9.9.9.9`) every 60 seconds.
2. **On-Demand & Scheduled Speedtests**: Utilizes Cloudflare Speedtest CDN edges to measure jitter, ping latency, download Mbps, and upload Mbps without relying on external third-party binary bloat.
3. **HTTP/HTTPS Website Availability**: Monitors target internal/external endpoints with TLS certificate validation, response time tracking, and HTTP status code verification.
4. **NOC Wallboard Display**: High-contrast, full-screen dashboard designed for continuous monitoring operations.

---

## 2. System Architecture & Measurement Pipeline

```mermaid
flowchart TD
    SCHED["Monitoring Scheduler Loop"] --> WAN_PROBE["WAN Reachability Worker"]
    SCHED --> DNS_PROBE["DNS Multi-Resolver Worker"]
    SCHED --> HTTP_PROBE["Website Uptime Worker"]
    USER["User Click 'Run Speedtest'"] --> SPEED_WORKER["Speedtest Execution Worker"]

    WAN_PROBE --> WAN_METRIC["Gateway ICMP & WAN IP Check"]
    DNS_PROBE --> DNS_METRIC["Query 1.1.1.1, 8.8.8.8, 9.9.9.9"]
    HTTP_PROBE --> HTTP_METRIC["GET / Endpoint Health (200 OK)"]
    SPEED_WORKER --> SPEED_METRIC["Throughput (Down/Up Mbps, Latency)"]

    WAN_METRIC --> DB_WAN[(internet_health_logs)]
    DNS_METRIC --> DB_WAN
    HTTP_METRIC --> DB_HTTP[(monitored_websites)]
    SPEED_METRIC --> DB_SPEED[(speedtest_results)]

    DB_WAN --> UI_DASH["/monitoring Dashboard"]
    DB_HTTP --> UI_DASH
    DB_SPEED --> UI_DASH
    DB_SPEED --> UI_WALL["/monitoring/wallboard NOC Display"]
```

---

## 3. Speedtest State & Measurement Sequence

```mermaid
sequenceDiagram
    autonumber
    participant UI as Frontend (/monitoring)
    participant API as FastAPI Backend
    participant Worker as Speedtest Service
    participant Edge as Cloudflare CDN Edge Server
    participant DB as PostgreSQL 16

    UI->>API: POST /api/v1/monitoring/speedtest/run
    API->>Worker: Launch asynchronous speedtest task
    API-->>UI: 202 Accepted (Task ID returned)
    
    Worker->>Edge: 10x Ping latency burst
    Edge-->>Worker: RTT timestamps (calculate min/avg/jitter)
    
    Worker->>Edge: Download chunk stream (25MB payload)
    Edge-->>Worker: Measure byte transfer rate
    Worker->>Worker: Calculate Download Mbps
    
    Worker->>Edge: Upload POST stream (10MB payload)
    Edge-->>Worker: Measure ACK transfer rate
    Worker->>Worker: Calculate Upload Mbps
    
    Worker->>DB: INSERT INTO speedtest_results (ping, download, upload, jitter)
    UI->>API: GET /api/v1/monitoring/speedtest/history?limit=10
    API->>DB: Query historical metrics
    DB-->>API: Return historical results
    API-->>UI: Return updated bandwidth telemetry
    UI->>UI: Update Speedtest Graph & Gauges
```

---

## 4. Database Schema Design

### `speedtest_results`
```sql
CREATE TABLE speedtest_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ping_ms FLOAT NOT NULL,
    jitter_ms FLOAT NOT NULL,
    download_mbps FLOAT NOT NULL,
    upload_mbps FLOAT NOT NULL,
    server_name VARCHAR(100),
    server_location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_speedtest_created_at ON speedtest_results(created_at);
```

### `internet_health_logs`
```sql
CREATE TABLE internet_health_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_connected BOOLEAN NOT NULL,
    wan_ip VARCHAR(45),
    gateway_latency_ms FLOAT,
    dns_resolution_ms FLOAT,
    dns_resolvers JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```
