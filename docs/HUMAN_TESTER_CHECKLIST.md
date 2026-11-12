# WATCHNET: HUMAN TESTER STEP-BY-STEP CHECKLIST

**Platform Baseline:** WatchNet Rebuild v1.0.0  
**Target Audience:** QA Engineers, Product Owners, Infrastructure Architects  
**Prerequisites:** Docker Engine 24+, Modern Web Browser (Chrome, Firefox, Safari, Edge)  

---

## 1. Environment Quickstart

### Step 1.1: Clone and Start Containers
From the repository root (`D:\WatchNet`):
```bash
docker compose -f infrastructure/docker-compose.yml up -d
```
Verify that all 6 containers are running:
```bash
docker compose -f infrastructure/docker-compose.yml ps
```
Expected running services:
- `watchnet-postgres` (PostgreSQL 16 with pgvector & RLS)
- `watchnet-redis` (Redis 7 caching & task queuing)
- `watchnet-api` (FastAPI backend engine on port 8000)
- `watchnet-collector` (Go 1.22 raw packet discovery engine)
- `watchnet-web` (Next.js 14 Web Console on port 3000)
- `watchnet-proxy` (Caddy reverse proxy on port 80/443)

### Step 1.2: Seed Sample Data
Populate the database with realistic devices, presence history, probe targets, and alert rules:
```bash
python scripts/seed_data.py
```

### Step 1.3: Access URLs & Credentials
- **Web Console:** [http://localhost:80](http://localhost:80)
- **API Swagger Documentation:** [http://localhost:80/docs](http://localhost:80/docs)
- **Admin Username:** `admin`
- **Admin Password:** `AdminPassword123!`

---

## 2. Interactive Verification Scenarios

### Scenario 1: Authentication & Dashboard Overview
1. Navigate to `http://localhost:80`.
2. Confirm the dashboard loads with:
   - Total Devices, Online Count, and Offline Count summary cards.
   - Network Activity timeline graph.
   - Recent Alerts stream.
3. Verify that metric counts reflect the seeded dataset (7+ devices).
- **Pass Criteria:** [ ] Dashboard displays accurate summary cards with no UI layout artifacts.

---

### Scenario 2: Device Inventory Exploration & Real-Time Filtering
1. Click **Devices** in the sidebar navigation or navigate to `http://localhost:80/devices`.
2. Observe the device inventory table displaying:
   - Hostname / Name
   - Primary IP Address
   - MAC Address
   - Vendor Profile (e.g. Apple, Ubiquiti, Supermicro)
   - Online / Offline Status Badge
   - Last Seen timestamp
3. Locate the table search box (`Search hostname, IP, MAC, vendor...`).
4. Type `MacBook` into the search box:
   - Confirm only the MacBook Pro device remains visible.
5. Clear the search box:
   - Confirm all devices reappear instantly.
- **Pass Criteria:** [ ] Inventory displays seeded devices; real-time search filters instantly without page reload.

---

### Scenario 3: Device Diagnostics Slide-Over Modal
1. On the Devices table, locate the row for `MacBook-Pro-M2`.
2. Click the **Diagnostics** button (activity icon) in the right-hand action column.
3. Observe the slide-over diagnostics modal opening:
   - Check device metadata (Device Type, Assigned Owner, MAC, IP).
   - Test quick ping trigger or inspect recent presence history.
4. Click the close button (**X**) or click outside the modal to dismiss it.
- **Pass Criteria:** [ ] Modal opens smoothly, displays accurate device details, and closes cleanly.

---

### Scenario 4: Presence Heatmap Matrix
1. Click **Presence** in the sidebar or navigate to `http://localhost:80/presence`.
2. Observe the 24-hour presence matrix:
   - Each device has an hourly block row across the 24-hour timeline.
   - Green blocks represent active presence sessions; grey blocks represent inactive hours.
3. Hover over presence blocks to view timestamp and session duration tooltips.
- **Pass Criteria:** [ ] Heatmap matrix renders with green activity cells representing seeded sessions.

---

### Scenario 5: Network Topology Canvas
1. Click **Topology** in the sidebar or navigate to `http://localhost:80/topology`.
2. Observe the topology visualization:
   - Gateway / Core Switch node (`Core-Switch-USW-24`).
   - Connected leaf devices (TrueNAS, Workstations, Access Points).
3. Test canvas zoom and drag controls.
- **Pass Criteria:** [ ] Topology canvas visually maps hierarchical switch-to-device relationships.

---

### Scenario 6: Diagnostics Workbench
1. Click **Diagnostics** in the sidebar or navigate to `http://localhost:80/diagnostics`.
2. Click through the workbench tabs:
   - **ICMP Ping:** Test pinging `127.0.0.1` or gateway IP.
   - **Port Scanner:** View TCP port range scanner options.
   - **DNS Lookup:** Test resolving local hostnames.
   - **Wake-on-LAN:** Verify MAC packet generator input form.
- **Pass Criteria:** [ ] All diagnostics tabs render and accept inputs without errors.

---

### Scenario 7: Integrations Hub
1. Click **Integrations** in the sidebar or navigate to `http://localhost:80/integrations`.
2. Inspect the configured and available integration channels:
   - Generic Webhook (with HMAC-SHA256 signature support)
   - Slack Incoming Webhook
   - Discord Webhook
   - Telegram Bot
   - Home Assistant MQTT Discovery
- **Pass Criteria:** [ ] Integration cards render with toggle states and configuration dialogs.

---

### Scenario 8: Interactive API Documentation
1. Navigate to `http://localhost:80/docs`.
2. Explore the OpenAPI endpoints under:
   - `Authentication`
   - `Devices`
   - `Discovery`
   - `Presence`
   - `Diagnostics`
   - `Integrations`
   - `System`
3. Click `POST /api/v1/auth/token` -> **Try it out** -> enter username `admin` and password `AdminPassword123!` -> click **Execute**.
4. Confirm HTTP 200 response with `access_token`.
- **Pass Criteria:** [ ] Swagger UI renders with full stylesheet/script styling and executes endpoints successfully.

---

## 3. Evaluator Sign-Off Table

| Scenario | Evaluator Name | Result (PASS / FAIL) | Date | Notes |
| :--- | :--- | :---: | :---: | :--- |
| Scenario 1: Authentication & Dashboard | | | | |
| Scenario 2: Device Inventory & Search | | | | |
| Scenario 3: Device Diagnostics Modal | | | | |
| Scenario 4: Presence Heatmap | | | | |
| Scenario 5: Topology Canvas | | | | |
| Scenario 6: Diagnostics Workbench | | | | |
| Scenario 7: Integrations Hub | | | | |
| Scenario 8: Swagger API Documentation | | | | |

