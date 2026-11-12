# WatchNet Upgrade Guide — v1.0.0-rc.1

**Product:** WatchNet Enterprise Network Intelligence & Monitoring  
**Target Version:** `v1.0.0-rc.1`  
**Supported Source Versions:** Legacy NetAlertX (v24.x, v25.x), WatchNet Pre-RC Milestones  

---

## 1. Upgrade Prerequisites

Before performing any upgrade:
1. **Create a full database backup**:
   - Access **Settings -> Backup & Export** (`/settings`) in the UI and click **Create Backup Archive**.
   - Or execute a database snapshot via Docker:
     ```bash
     docker exec -t watchnet-postgres pg_dump -U postgres watchnet > pre_upgrade_backup.sql
     ```
2. **Back up configuration files**:
   ```bash
   cp docker/.env docker/.env.bak
   ```

---

## 2. Upgrading from WatchNet Beta / Previous Phases

### Step 1: Pull the Latest Release Branch
```bash
git fetch --all
git checkout release/1.0.0-rc.1
git pull origin release/1.0.0-rc.1
```

### Step 2: Rebuild Application Containers
```bash
cd docker
docker compose build --no-cache backend frontend collector
```

### Step 3: Run Database Migrations
Execute Alembic migrations to apply any schema updates (such as router integration level fields and family safety tables):
```bash
docker compose exec backend alembic upgrade head
```

### Step 4: Restart WatchNet Stack
```bash
docker compose up -d
```

### Step 5: Verify Running Version
```bash
curl -s http://localhost:8000/api/v1/version
```
Confirm the returned version is `"1.0.0-rc.1"`.

---

## 3. Migrating from Legacy NetAlertX (SQLite)

WatchNet is a clean-room modern platform replacing NetAlertX's PHP/SQLite architecture with FastAPI/PostgreSQL. Follow these steps to migrate your existing devices:

### Step 1: Export Devices from NetAlertX
In your legacy NetAlertX web interface:
1. Navigate to **Maintenance / Backup**.
2. Export the complete device list as a CSV file (`devices.csv`).

### Step 2: Import into WatchNet
1. In WatchNet, navigate to **Settings -> Backup & Export** (`/settings`).
2. Under **Device CSV Migration**, select your legacy `devices.csv`.
3. Choose the conflict resolution strategy:
   - **Overwrite:** Updates matching MAC records with legacy names, vendors, and notes.
   - **Skip:** Keeps existing WatchNet discoveries intact and adds new devices.
4. Click **Import Devices CSV**.

### Step 3: Verify Device Inventory
Navigate to **Devices** (`/devices`) to verify that all historical IP mappings, custom aliases, device types, and static notes have populated.

---

## 4. Rollback Procedure

If any issue occurs during the upgrade:
1. Stop the updated stack:
   ```bash
   docker compose down
   ```
2. Checkout the previous release checkpoint or commit:
   ```bash
   git checkout <previous_checkpoint_commit>
   ```
3. Restore the PostgreSQL database:
   ```bash
   docker compose up -d postgres
   cat pre_upgrade_backup.sql | docker exec -i watchnet-postgres psql -U postgres watchnet
   ```
4. Restart the stack with the previous containers:
   ```bash
   docker compose up -d
   ```
