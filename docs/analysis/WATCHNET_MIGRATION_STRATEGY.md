# WatchNet Migration Strategy

**Document Version:** 1.0.0  
**Target:** Safe Ingestion & Upstream Database Migration  
**Source Baseline:** NetAlertX SQLite (`app.db`)  
**Target Persistence:** WatchNet PostgreSQL 16 Schema  

---

## 1. Migration Overview

To allow existing NetAlertX users to seamlessly adopt WatchNet without losing historical presence data, device labels, or network topology, WatchNet provides a dedicated one-click database migration pipeline.

---

## 2. Source SQLite Ingestion Pipeline

```
[ NetAlertX app.db ]
        |
        v (Read-Only SQLite Connector)
[ WatchNet Migration Engine ]
        |
        +---> Schema Version Validation & Integrity Check
        |
        +---> Data Sanitization & Normalization Pipeline
        |        |-- Normalize MAC formats (AA:BB:CC:DD:EE:FF)
        |        |-- Validate IPv4 / IPv6 syntax
        |        |-- Convert Unix / SQLite timestamps to UTC ISO 8601
        |        \-- Strip unsafe HTML / control characters
        |
        v (Alembic Batch Inserts / COPY)
[ WatchNet PostgreSQL 16 ]
```

---

## 3. Entity Mapping Specification

| NetAlertX Table | NetAlertX Columns | WatchNet Target Table | WatchNet Columns | Transformation Notes |
| :--- | :--- | :--- | :--- | :--- |
| `Devices` | `devMac`, `devIp`, `devName`, `devVendor`, `devType`, `devStatus` | `devices` | `mac_address`, `ip_address`, `display_name`, `vendor_name`, `device_type`, `status` | Normalized MAC; UUID primary key created |
| `Events` | `eveMac`, `eveIp`, `eveDateTime`, `eveEventType`, `eveAdditionalInfo` | `device_events` | `device_id`, `ip_address`, `timestamp`, `event_type`, `details` | Foreign key linked to `devices.id` |
| `Sessions` | `sesMac`, `sesDateTimeConnection`, `sesDateTimeDisconnection` | `device_sessions` | `device_id`, `connected_at`, `disconnected_at`, `is_active` | Timestamp parsed to timezone-aware UTC |
| `Settings` | `setKey`, `setValue` | `system_settings` | `setting_key`, `setting_value` | Legacy keys remapped to modern hierarchical config |

---

## 4. Verification and Rollback Safeguards

1. **Read-Only Invariant**: The source `app.db` file is opened exclusively in read-only mode (`file:app.db?mode=ro`). No write operations are ever issued against the original file.
2. **Transaction Atomicity**: The entire migration executes within a single PostgreSQL transaction. Any schema error or integrity failure triggers an immediate `ROLLBACK`, leaving the database clean.
3. **Migration Dry-Run**: Users can execute a dry-run validation that outputs an audit summary showing devices parsed, sessions migrated, and potential syntax conflicts.
