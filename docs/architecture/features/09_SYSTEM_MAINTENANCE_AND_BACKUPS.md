# WatchNet Architecture: System Maintenance, Backups & Disaster Recovery

## 1. Executive Summary & Capabilities
The **System Maintenance Subsystem** guarantees long-term database stability, high query performance, and disaster recovery:
1. **One-Click Encrypted Database Backups**: Compresses database tables, schema revisions, and user configuration into timestamped `.tar.gz` archives.
2. **Download & Restore Pipeline**: Allows downloading backup archives directly through the browser or uploading existing snapshots to restore a system.
3. **Automated Partition Rotation & Vacuuming**: Runs asynchronous SQLite `VACUUM` or PostgreSQL table re-indexing to prevent storage fragmentation.
4. **Data Retention Policies**: Configurable retention periods (e.g. 30, 90, 180, 365 days) that prune stale presence history and old scan logs automatically.

---

## 2. Backup & Restore Architecture

```mermaid
flowchart TD
    subgraph TriggerLayer ["Backup Trigger"]
        UI_BTN["User Clicks 'Create Backup'"]
        CRON["Scheduled Daily Backup Cron"]
    end

    subgraph BackupPipeline ["Backup Engine Worker"]
        EXPORT["Dump Relational Tables (CSV / SQL)"]
        CONF["Serialize User Config & Encryption Keys"]
        COMPRESS["Gzip Compression (.tar.gz)"]
        HASH["Compute SHA-256 Checksum"]
    end

    subgraph Storage ["Archive Storage"]
        DIR["Local Filesystem (/backups)"]
        META["Record Metadata in audit_logs"]
    end

    subgraph Recovery ["Disaster Recovery"]
        UPLOAD["User Uploads .tar.gz"]
        VERIFY["Verify SHA-256 & Unpack"]
        RESTORE["Import Tables & Rebuild Indexes"]
    end

    UI_BTN --> EXPORT
    CRON --> EXPORT
    EXPORT --> CONF
    CONF --> COMPRESS
    COMPRESS --> HASH
    HASH --> DIR
    DIR --> META
    
    DIR --> UPLOAD
    UPLOAD --> VERIFY
    VERIFY --> RESTORE
```

---

## 3. Sequence: One-Click Backup Generation

```mermaid
sequenceDiagram
    autonumber
    participant UI as Settings UI (/settings)
    participant API as FastAPI Backend (/api/v1/system)
    participant Worker as Backup Worker Process
    participant DB as PostgreSQL 16
    participant Storage as Backup Directory (D:/WatchNet-Rebuild/backups)

    UI->>API: POST /api/v1/system/backup
    API->>Worker: Launch asynchronous backup task
    API-->>UI: 202 Accepted (Backup in Progress)
    
    Worker->>DB: Query table list and export records
    Worker->>Worker: Build archive watchnet_backup_YYYYMMDD_HHMMSS.tar.gz
    Worker->>Storage: Write compressed archive file to disk
    Worker->>Storage: Generate accompanying .sha256 checksum file
    
    UI->>API: GET /api/v1/system/backups
    API->>Storage: Scan directory for existing archives
    Storage-->>API: Return filenames, creation timestamps, and sizes in KB
    API-->>UI: JSON list of available backups
    UI->>UI: Render Backup Archive Table with Download buttons
```

---

## 4. API Endpoints Specification

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/system/backup` | `POST` | Create | Triggers asynchronous creation of a new `.tar.gz` database archive. |
| `/api/v1/system/backups` | `GET` | Inventory | Returns metadata for all backup archives present on disk. |
| `/api/v1/system/backup/download/{filename}` | `GET` | Download | Streams the compressed `.tar.gz` file directly to the browser. |
| `/api/v1/system/vacuum` | `POST` | Maintenance | Rebuilds database indexes and runs `VACUUM ANALYZE` on PostgreSQL. |
| `/api/v1/system/maintenance/stats` | `GET` | Health | Reports active database connection counts, database size on disk, and table row statistics. |
