# Database Architecture & Entity Relationship Model

**Document Version:** 1.0.0  
**Target Engine:** PostgreSQL 16  

---

## 1. Multi-Tenant Relational Schema

WatchNet implements an enterprise-grade relational schema designed for high-concurrency ingestion and row-level tenant isolation:

```
┌─────────────────────────────────┐
│            tenants              │
├─────────────────────────────────┤
│ id: UUID (PK)                   │
│ name: VARCHAR(100)              │
│ created_at: TIMESTAMPTZ         │
└───────────────┬─────────────────┘
                │ 1:N
        ┌───────┴───────────────────────────────────────────┐
        ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│            devices              │         │             users               │
├─────────────────────────────────┤         ├─────────────────────────────────┤
│ id: UUID (PK)                   │         │ id: UUID (PK)                   │
│ tenant_id: UUID (FK) [RLS]      │         │ tenant_id: UUID (FK) [RLS]      │
│ mac_address: VARCHAR(17)        │         │ email: VARCHAR(255)             │
│ ip_address: INET                │         │ hashed_password: VARCHAR(255)   │
│ hostname: VARCHAR(255)          │         │ role: VARCHAR(50)               │
│ vendor: VARCHAR(150)            │         │ is_active: BOOLEAN              │
│ status: VARCHAR(30)             │         └─────────────────────────────────┘
│ first_seen: TIMESTAMPTZ         │
│ last_seen: TIMESTAMPTZ          │
│ custom_attributes: JSONB        │
└───────┬─────────────────────────┘
        │ 1:N
        ├───────────────────────────────────────────────────┐
        ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│            sessions             │         │             events              │
├─────────────────────────────────┤         ├─────────────────────────────────┤
│ id: UUID (PK)                   │         │ id: UUID (PK)                   │
│ tenant_id: UUID (FK) [RLS]      │         │ tenant_id: UUID (FK) [RLS]      │
│ device_id: UUID (FK)            │         │ device_id: UUID (FK)            │
│ ip_address: INET                │         │ event_type: VARCHAR(50)         │
│ connected_at: TIMESTAMPTZ       │         │ timestamp: TIMESTAMPTZ          │
│ disconnected_at: TIMESTAMPTZ    │         │ metadata: JSONB                 │
│ is_active: BOOLEAN              │         └─────────────────────────────────┘
└─────────────────────────────────┘
```

---

## 2. Row-Level Security (RLS) Policy Definition

PostgreSQL Row-Level Security guarantees that no query can access or modify data belonging to another tenant, even in the event of an application logic bug:

```sql
-- Enable RLS on core tables
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_observations ENABLE ROW LEVEL SECURITY;

-- Enforce policy based on active transaction tenant variable
CREATE POLICY tenant_isolation_devices ON devices
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_sessions ON sessions
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY tenant_isolation_events ON events
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

---

## 3. Data Retention & Partitioning Strategy

1. **Partitioning:** High-frequency event tables (`events`, `raw_observations`, `system_metrics`) are partitioned by range on `timestamp` (monthly partitions).
2. **Automated Pruning:** A background worker executes non-blocking maintenance tasks to drop partitions older than the tenant's configured retention limit (default: 90 days), avoiding slow `DELETE FROM` statements and table bloat.
