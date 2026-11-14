# WATCHNET v1.0.0-rc.1 — USER OPERATIONAL & HOW-TO GUIDE

Welcome to **WatchNet** — the modern, secure, self-hosted network monitoring and device intelligence platform.

---

## 1. Quick Start: How to Run WatchNet

WatchNet can be run in two ways:
1. **Containerized via Docker (Recommended for production/appliances)**
2. **Direct Local Execution (For local development or testing on Windows/Linux)**

---

### Option A: Running with Docker (Recommended)

#### Prerequisites:
- Docker Engine & Docker Compose installed and running.

#### Steps:
1. Open PowerShell or Terminal and navigate to the project directory:
   ```bash
   cd D:\WatchNet-Rebuild
   ```
2. Start the full multi-container stack (Frontend, Backend, Database, Redis, Reverse Proxy):
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```
3. Open your browser and navigate to:
   - **Web UI:** [http://localhost:3000](http://localhost:3000) (or via reverse proxy on port 80: [http://localhost](http://localhost))
   - **Backend API & Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Running Locally on Windows (Step-by-Step)

If Docker is not running, you can run the Frontend and Backend directly on your machine:

#### 1. Start the Backend API (FastAPI)
Open a PowerShell terminal:
```powershell
# Navigate to the backend directory
cd D:\WatchNet-Rebuild\backend

# Activate the existing virtual environment
.\venv\Scripts\activate

# Launch the FastAPI application
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The Backend API will be live at `http://127.0.0.1:8000`. You can inspect the interactive OpenAPI/Swagger documentation at `http://127.0.0.1:8000/docs`.

#### 2. Start the Frontend Web UI (Next.js)
Open a second PowerShell terminal:
```powershell
# Navigate to the frontend directory
cd D:\WatchNet-Rebuild\frontend

# Option 1: Run the production standalone build (Fastest)
node .next/standalone/server.js

# Option 2: Run in development mode
npm run dev
```
The Frontend UI will be live at `http://localhost:3000`.

---

## 2. Default Login Credentials

Navigate to [http://localhost:3000/login](http://localhost:3000/login):
- **Username / Email:** `admin` (or `admin@watchnet.local`)
- **Default Password:** `admin123` (or the initial password configured during database seeding)

After logging in, an authenticated session cookie is issued, and you are automatically redirected to the **Overview Dashboard**.

---

## 3. How to Use WatchNet: Feature Walkthrough

### 1. Overview Dashboard (`/dashboard` or `/`)
- **Live Network Stats:** View total devices discovered, currently online devices, network gateway latency, and speedtest metrics.
- **Recent Events Feed:** Live stream of connection/disconnection events, IP changes, and alerts.
- **Top Categories:** Visual breakdown of devices (Mobile, Desktop, IoT/Smart Home, Network, Server).

### 2. Device Inventory (`/devices`)
- **Search & Filter:** Search by IP address, MAC address, hostname, or vendor. Filter by category or online/offline status.
- **Inspect Device Details:** Click any device row to open the detailed telemetry drawer (First seen, last seen, IP change history, session durations).
- **Field Locking:** Click the lock icon next to **Device Name** or **Category** to prevent automated network scans from overwriting your custom labels.
- **Bulk Actions:** Select multiple devices using checkboxes to perform batch categorization, tag assignments, or archival.

### 3. Network Discovery Engine (`/discovery`)
- **Trigger a Network Scan:** Click the blue **"Scan Network"** button to initiate an on-demand ARP and ICMP ping sweep across your local subnet.
- **Module Controls:** Toggle specific discovery modules (ARP Scan, ICMP Prober, DHCP Leases, Nmap, SNMP) on or off according to your preference.
- **Execution Logs:** View real-time logs displaying scanned IP ranges, response times, and new MAC addresses detected.

### 4. Network Monitoring & Speedtest (`/monitoring`)
- **Internet Connectivity:** Live tracking of WAN status, gateway latency, and multi-resolver DNS resolution speeds (Cloudflare, Google, Quad9).
- **On-Demand Speedtest:** Click **"Run Speedtest"** to measure live download, upload, ping latency, and jitter.
- **Website Uptime & SSL Expiration:** Add HTTP/HTTPS targets to monitor response codes, uptime percentage, and days remaining on SSL certificates.
- **NOC Wallboard Mode:** Navigate to `/monitoring/wallboard` for a full-screen, high-contrast operations display.

### 5. Network Topology (`/topology`)
- Interactive visual diagram mapping your network hierarchy:
  `Default Gateway / Router` ➔ `Switches & Access Points` ➔ `Connected Devices`
- Click any node to view device hardware, IP address, and open ports.

### 6. Router Management (`/routers`)
- **Supported Adapters:** OpenWrt, UniFi, ASUSWRT, FRITZ!Box, MikroTik RouterOS, and TP-Link Omada.
- **Integration Levels:** The system transparently displays whether a router is connected via `FULL_API`, `READ_ONLY`, or `PASSIVE_DISCOVERY` (such as consumer SOHO routers).
- **Client Telemetry:** View connected wireless clients with real-time Wi-Fi signal strength (RSSI in dBm) and frequency bands (2.4 GHz, 5 GHz, 6 GHz).

### 7. Family Safety & Parental Controls (`/family-safety`)
- **Household Profiles:** Create profiles for family members (e.g., "Kids", "Work Laptops", "Guests") and assign devices to each profile.
- **Instant Internet Pause:** Click the pause toggle on any profile card to immediately restrict internet access for all associated devices.
- **Bedtime Curfew Scheduling:** Configure recurring curfew schedules (e.g., Monday–Friday 21:00 to 07:00).
- **DNS Category Blocking:** Enable domain filtering for Adult content, Gambling, Social Media, and Malware.
- **DNS Activity Feed (`/activity`):** View real-time domain query logs with Allowed/Blocked status badges.

### 8. Notifications & Workflows (`/notifications` & `/workflows`)
- **Notification Inbox:** In-app alert inbox with unread badges and severity indicators (`INFO`, `WARNING`, `CRITICAL`).
- **Delivery Channels:** Configure outbound alerts via Email (SMTP), Telegram, Pushover, Pushsafer, NTFY, MQTT, Webhooks, or Apprise.
- **Workflow Automation:** Create custom rule triggers (e.g., *IF New Device Detected AND Category == 'IoT' THEN Send Notification to Telegram*).

### 9. Multi-Site Management (`/multisite`)
- Register remote branch collectors (e.g., "Home", "Office", "Branch A") and monitor centralized device inventories across multiple locations.

### 10. System Maintenance & Backups (`/settings`)
- **Create Backups:** Click **"Create Database Backup"** to download a compressed archive of all devices, settings, profiles, policies, and histories.
- **Disaster Recovery Restore:** Upload any previous backup file to restore your entire network state with transactional validation.
- **Data Retention & Pruning:** Configure retention schedules (e.g., keep device sessions for 90 days, DNS logs for 14 days) and run on-demand database cleanups.
- **CSV Export/Import:** Export and import device inventories matching legacy NetAlertX format.

---

## 4. Verification Evidence & Automated Tests

All functionality in this release candidate has been verified:
- **Backend Test Suite:** 47/47 Pytest integration tests passed (`pytest backend/tests`).
- **Collector Engine:** 3/3 Go discovery packages passed (`go test ./...`).
- **Frontend E2E Suite:** 30/30 Playwright browser tests passed across all 18 views.
- **Captured Screenshots:** Stored in `frontend/test-results/live_screenshots/`:
  - `login_screen.png` — Authenticated entry point.
  - `dashboard_overview.png` — Overview dashboard with metrics.
  - `devices_inventory.png` — Device inventory with TanStack table.
  - `settings_backup.png` — Settings and backup tools.

