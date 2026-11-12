# WatchNet Privacy and Data Retention Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Compliance Baseline:** GDPR, CCPA, Local Data Sovereignty  
**Applicability:** Historical Intelligence, Event Logs, Device IP History, Retention Sweepers  

---

## 1. Data Sovereignty & User Ownership

WatchNet operates on the principle of complete data sovereignty:
1. **Zero External Exfiltration:** No telemetry, MAC addresses, device inventories, or network activity logs are transmitted to external cloud servers, vendors, or marketing platforms.
2. **Local Processing:** All machine learning vendor lookups, MAC OUI resolutions, and category categorizations execute locally using cached offline databases.
3. **Right to Erasure:** Administrators possess granular controls to delete individual device histories, site records, or full account data instantly.

```mermaid
flowchart LR
    COL[Network Ingest Telemetry] --> HOT[(Hot Storage: PostgreSQL Live)]
    HOT -->|After 30 Days| WARM[(Warm Storage: Hourly Aggregations)]
    WARM -->|After Configured Window| PURGE[Scheduled Retention Purge Worker]
    PURGE -->|Unlinked Hard Delete| TRASH[Zero-Overwrite Reclamation]
```

---

## 2. Retention Schedules & Lifecycle Policies

To balance deep historical network intelligence with database size constraints and privacy requirements, WatchNet implements automated multi-tiered retention schedules:

| Data Category | Table Name | Default Retention Window | Aggregation / Rollup Policy |
|---|---|---|---|
| **Raw Discovery Observations** | `discovery_observations` | 48 hours | Parsed into device state changes, raw events deleted |
| **Active Network Sessions** | `device_sessions` | 90 days | Consolidated into daily online uptime percentages |
| **IP / MAC Binding History** | `device_ip_history` | 180 days | Retains first-seen and last-seen intervals per IP |
| **DNS Query Logs** | `dns_query_logs` | 7 days | Obfuscated domain rollups aggregated into hourly totals |
| **System & Security Alerts** | `alerts` | 60 days | Resolved alerts older than 60 days pruned |
| **Immutable Audit Logs** | `audit_logs` | 365 days (1 year) | Cryptographically chained, administrative retention |

---

## 3. Automated Retention Cleanup Worker

WatchNet executes a daily background maintenance task managed by Celery/Async workers:
- **Scheduled Window:** Executes at 03:00 local site time.
- **Batched Deletion:** Uses chunked deletions (`DELETE FROM ... WHERE timestamp < :cutoff LIMIT 5000`) with explicit pauses to avoid PostgreSQL table lock contention and transaction log bloat.
- **Reindexing & VACUUM:** Executes periodic `VACUUM (ANALYZE)` on partitioned high-churn tables to reclaim disk space.

---

## 4. Export & Data Portability

WatchNet provides standard data export options accessible to `SUPER_ADMIN` users:
- **JSON Full Archive:** Complete tenant export containing device inventories, custom properties, network topologies, and alerts.
- **CSV Summary Reports:** Exportable device lists and 30-day presence logs for network audit compliance.
