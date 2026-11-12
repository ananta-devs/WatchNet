# WatchNet v1.0.0 — Production Deployment & Operations Guide

## 1. Architecture Overview

WatchNet is composed of four decoupled microservices and two persistent data layers:

| Component | Technology | Role | Port |
| :--- | :--- | :--- | :--- |
| **Reverse Proxy** | Caddy 2 (Alpine) | SSL termination, mTLS, anti-SSRF ingress, security headers | 80, 443 |
| **Web Console** | Next.js 14 / React 18 | Interactive web dashboard, 24h presence heatmap, device table | 3000 |
| **Core API & Engine** | FastAPI (Python 3.11/3.13) | Multi-tenant REST API, Model Context Protocol (MCP), Apprise | 8000 |
| **Discovery Collector** | Pure Go Daemon | Raw-socket ARP sweeping, ICMP, mDNS, NetBIOS, Rogue DHCP | Host / Net |
| **Database** | PostgreSQL 16 (Alpine) | Relational data, Row-Level Security (RLS) tenant isolation | 5432 |
| **Cache & Bus** | Redis 7 (Alpine) | Alert deduplication, throttles, pub/sub presence events | 6379 |

---

## 2. Prerequisites

### Minimal System Requirements
- **CPU:** 2 vCPU cores (x86_64 or arm64)
- **RAM:** 2 GB minimum (4 GB recommended for networks > 1,000 devices)
- **Disk:** 20 GB SSD storage
- **Operating System:** Ubuntu 22.04 LTS+, Debian 12+, RHEL 9+, or Windows Server 2022+ with Docker Engine 24+

### Network Capabilities
The Go Discovery Collector requires network packet crafting capabilities:
```bash
# On Linux host
sudo setcap cap_net_raw,cap_net_admin=+ep /usr/local/bin/watchnet-collector
```

---

## 3. Quickstart Deployment via Docker Compose

### 3.1 Clone & Configure Environment
Navigate to the `infrastructure/` directory:
```bash
cd /opt/watchnet/infrastructure
```

Create `.env` file:
```env
POSTGRES_DB=watchnet
POSTGRES_USER=watchnet_root
POSTGRES_PASSWORD=generate_a_secure_password_here
DATABASE_URL=postgresql+asyncpg://watchnet_root:generate_a_secure_password_here@watchnet-postgres:5432/watchnet
REDIS_URL=redis://watchnet-redis:6379/0
SECRET_KEY=generate_a_random_64_character_hex_key_here
WATCHNET_API_URL=http://watchnet-api:8000
WATCHNET_API_TOKEN=collector-secret-bearer-token
WATCHNET_SUBNETS=192.168.1.0/24
WATCHNET_RATE_LIMIT_PPS=100
```

### 3.2 Launch Service Stack
```bash
docker compose up -d
```

Verify running containers:
```bash
docker compose ps
```

All 6 services will report `running` and `healthy`:
- `watchnet-postgres`
- `watchnet-redis`
- `watchnet-api`
- `watchnet-collector`
- `watchnet-web`
- `watchnet-proxy`

---

## 4. Accessing WatchNet

Open your web browser and navigate to:
```
http://<server-ip>/
```
- **Web Console:** `http://<server-ip>/`
- **Interactive REST API Docs:** `http://<server-ip>/docs`
- **Model Context Protocol Endpoint:** `http://<server-ip>/api/v1/mcp`
- **System Health Status:** `http://<server-ip>/api/v1/system/health`

---

## 5. Standalone Remote Collector Deployment

For multi-site or remote branch deployments, deploy only the lightweight Go Collector binary (`watchnet-collector`):

```bash
# Compile for Linux arm64 (e.g. Raspberry Pi)
GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o watchnet-collector ./cmd/watchnet-collector

# Run daemon pointing to central WatchNet API
export WATCHNET_API_URL="https://watchnet.example.com"
export WATCHNET_API_TOKEN="collector-shared-secret"
export WATCHNET_SITE_ID="site-uuid-branch-office"
export WATCHNET_SUBNETS="10.10.0.0/24,10.10.10.0/24"
export WATCHNET_RATE_LIMIT_PPS=150

./watchnet-collector
```

The daemon automatically buffers observations locally if connectivity to the central WatchNet API is interrupted, and drains the backlog when connection is restored.

