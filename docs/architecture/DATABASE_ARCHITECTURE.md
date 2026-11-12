# WatchNet Database Architecture

**Document Version:** 1.0.0  
**Engine:** PostgreSQL 16  
**Migration Framework:** Alembic  
**ORM:** SQLAlchemy 2.0 (AsyncIO)  

---

## 1. Relational Entity Schema

WatchNet replaces upstream SQLite with a fully relational, normalized PostgreSQL schema.

```
+-----------------------------------+         +-----------------------------------+
|              tenants              |         |               users               |
+-----------------------------------+         +-----------------------------------+
| id : UUID (PK)                    |1       *| id : UUID (PK)                    |
| name : VARCHAR(100)               +---------+ tenant_id : UUID (FK)             |
| created_at : TIMESTAMPTZ          |         | email : VARCHAR(255)              |
+-----------------+-----------------+         | role : VARCHAR(50)                |
                  |                           +-----------------------------------+
                  |1
+-----------------v-----------------+         +-----------------------------------+
|              devices              |         |          device_sessions          |
+-----------------------------------+         +-----------------------------------+
| id : UUID (PK)                    |1       *| id : UUID (PK)                    |
| tenant_id : UUID (FK)             +---------+ device_id : UUID (FK)             |
| mac_address : MACADDR (Indexed)   |         | connected_at : TIMESTAMPTZ        |
| ip_address : INET                 |         | disconnected_at : TIMESTAMPTZ     |
| display_name : VARCHAR(150)       |         | is_active : BOOLEAN               |
| vendor_name : VARCHAR(150)        |         +-----------------------------------+
| device_type : VARCHAR(50)         |
| status : VARCHAR(20)              |1       *+-----------------------------------+
| metadata : JSONB                  +---------+           device_events           |
+-----------------------------------+         +-----------------------------------+
                                              | id : BIGSERIAL (PK)               |
                                              | device_id : UUID (FK)             |
                                              | timestamp : TIMESTAMPTZ (Part Key)|
                                              | event_type : VARCHAR(50)          |
                                              | details : JSONB                   |
                                              +-----------------------------------+
```

---

## 2. Partitioning & Data Retention

To ensure sustained database performance over years of network events without SQLite write-lock degradation:
- **`device_events` Partitioning**: Range partitioned by month on the `timestamp` column (`PARTITION BY RANGE (timestamp)`).
- **Automated Retention Pruning**: Monthly partition rotation managed by background Celery tasks or `pg_partman`. Expired event partitions can be detached or dropped instantly with zero table-locking impact.
- **GIN Indexing**: Applied to `devices.metadata` and `device_events.details` to enable high-speed queries across dynamic plugin attributes and port lists.

---

## 3. Multi-Tenancy & Row-Level Security (RLS)

All primary tables enforce PostgreSQL Row-Level Security:
```sql
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON devices
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```
