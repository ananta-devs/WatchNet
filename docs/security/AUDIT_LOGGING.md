# WatchNet Audit Logging

**Document Version:** 1.0.0  
**Retention:** Immutable Chronological Log  

---

## 1. Audit Logging Specification

WatchNet maintains a dedicated, append-only audit trail (`audit_logs`) recording every administrative and security-relevant event:
- User login success, failure, and MFA verification attempts.
- Device attribute edits, deletions, or status overrides.
- Router credential updates and manual network scan triggers.
- DNS policy changes and scheduled downtime alterations.
- Diagnostic tool executions (Ping, Portscan, Wake-on-LAN).

---

## 2. Audit Record Schema

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique event identifier |
| `tenant_id` | UUID | Tenant context |
| `timestamp` | TIMESTAMPTZ | UTC timestamp of event |
| `user_id` | UUID | Actor user ID (or null for automated task) |
| `ip_address` | INET | Originating client IP |
| `action` | VARCHAR(100) | Standardized action verb (e.g. `DEVICE_UPDATED`, `SCAN_TRIGGERED`) |
| `resource` | VARCHAR(100) | Target entity identifier |
| `changes` | JSONB | Before/after state diff |
