# WatchNet Installation Guide — v1.0.0-rc.1

**Product:** WatchNet Enterprise Network Intelligence & Monitoring  
**Release Tag:** `v1.0.0-rc.1`  
**Target Platform:** Linux (Docker / Docker Compose), macOS, Windows 11 (WSL2 / Docker Desktop)  

---

## 1. System Requirements

### 1.1 Hardware Specifications
- **CPU:** 2 Cores minimum (4+ Cores recommended for subnets larger than `/23`).
- **RAM:** 2 GB minimum (4 GB recommended for PostgreSQL + Redis + Collector).
- **Disk:** 10 GB available SSD storage for container images and device session history.
- **Network Interface:** Dedicated physical or bridged Ethernet / Wi-Fi interface connected directly to the monitored broadcast domain.

### 1.2 Software Prerequisites
- **Docker Engine:** Version 24.0 or higher.
- **Docker Compose:** Version 2.20 or higher.
- **Linux Capabilities (for Collector container):** `NET_RAW`, `NET_ADMIN`.

---

## 2. Quick-Start Deployment (Docker Compose)

### Step 1: Clone or Extract the WatchNet Release Bundle
```bash
git clone -b release/1.0.0-rc.1 https://github.com/watchnet/watchnet.git
cd watchnet/docker
```

### Step 2: Configure Environment Variables
Copy the template configuration file:
```bash
cp ../.env.example .env
```

Edit `.env` to define secure secrets:
```ini
# PostgreSQL Configuration
POSTGRES_USER=watchnet
POSTGRES_PASSWORD=your_super_secure_pg_password_here
POSTGRES_DB=watchnet

# Redis Configuration
REDIS_PASSWORD=your_super_secure_redis_password_here

# WatchNet Core Security
# Must be at least 32 characters long
SECRET_KEY=generate_a_random_32_character_string_here

# Network Collector Settings
# Interface connected to your local subnet (e.g. eth0, eno1, enp3s0)
COLLECTOR_INTERFACE=eth0
SCAN_INTERVAL_SEC=30
```

### Step 3: Launch WatchNet Services
```bash
docker compose up -d
```

Verify that all 6 containers are healthy:
```bash
docker compose ps
```
Expected running containers:
1. `watchnet-postgres` (`postgres:16-alpine`)
2. `watchnet-redis` (`redis:7-alpine`)
3. `watchnet-backend` (`FastAPI Python 3.14`)
4. `watchnet-frontend` (`Next.js 16 App Router`)
5. `watchnet-collector` (`Go 1.27 Raw Socket Collector, host network`)
6. `watchnet-proxy` (`Caddy 2 Reverse Proxy`)

---

## 3. Initial Administrator Setup

Upon initial boot, access the web interface at:
`http://<your-server-ip>` or `http://localhost:3000`

1. Navigate to `http://<your-server-ip>/login`.
2. Initial credentials configured during seeding or setup:
   - **Username:** `admin`
   - **Password:** Configured via initial bootstrap or environment seed.
3. Immediately navigate to **Settings -> Security** (`/settings`) to update the administrative password.

---

## 4. Reverse Proxy & HTTPS Configuration (Caddy)

WatchNet bundles a preconfigured Caddy 2 reverse proxy.

To enable automated Let's Encrypt / ZeroSSL TLS certificates:
1. Edit `docker/Caddyfile`:
```caddy
your-domain.example.com {
    reverse_proxy /api/* backend:8000
    reverse_proxy frontend:3000
}
```
2. Restart Caddy:
```bash
docker compose restart caddy
```

---

## 5. Network Collector Host Networking Notes

To capture L2 broadcast ARP frames and send raw ICMP echo requests, the `watchnet-collector` container must run with `network_mode: "host"` and the Linux capabilities `NET_RAW` and `NET_ADMIN`.

If running on **Docker Desktop for Windows / macOS**, bridge discovery can scan IP addresses via ICMP/TCP, but Layer-2 ARP broadcast detection requires direct host network access or execution of the native Go collector binary:
```powershell
cd collector
go run ./cmd/collector
```

---

## 6. Verifying Installation Health

1. **System Health Endpoint:**
   ```bash
   curl -s http://localhost:8000/api/v1/health | jq .
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "database": "healthy",
     "redis": "healthy",
     "timestamp": "2026-11-12T..."
   }
   ```
2. **Version Metadata Endpoint:**
   ```bash
   curl -s http://localhost:8000/api/v1/version | jq .
   ```
   Expected response:
   ```json
   {
     "version": "1.0.0-rc.1",
     "project": "WatchNet",
     "environment": "production"
   }
   ```
