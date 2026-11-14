# WATCHNET REBUILD-002: DEFECT REGISTER & REMEDIATION LOG

**Document ID:** DEFREG-REBUILD-002  
**Baseline:** WatchNet Clean-Room Rebuild v1.0.0  
**Verification Date:** November 12, 2026  
**Status:** ALL DEFECTS RESOLVED & VERIFIED  

---

## 1. Executive Summary

During the execution of **TASK-WATCHNET-REBUILD-002** (Functional Verification, WatchNet Feature Parity, Security, Reliability & Human Testing Readiness), comprehensive end-to-end testing across Docker orchestration, browser automation, packet ingestion, async database queries, and security enforcement revealed 10 defects.

All 10 defects have been diagnosed, remediated in code or configuration, re-tested, and verified in the live running container stack. Zero known defects remain open.

---

## 2. Granular Defect Breakdown

### DEF-001: Go Collector Container Crash Loop (`operation not permitted`)
- **Severity:** Critical (P0) - Service crash loop
- **Component:** `services/collector/Dockerfile`, `infrastructure/docker-compose.yml`
- **Symptom:** Collector container died immediately upon startup with `exec /app/watchnet-collector: operation not permitted`.
- **Root Cause:** The Dockerfile set file capabilities using `setcap cap_net_raw,cap_net_admin=+ep /app/watchnet-collector`. Without user namespace capability inheritance configured in the Docker daemon, the kernel refused execution under non-root permissions.
- **Remediation:** Removed file-based `setcap` from Dockerfile, granted `chmod +x`, and configured standard Docker capability delegation in `infrastructure/docker-compose.yml`:
  ```yaml
  cap_add:
    - NET_RAW
    - NET_ADMIN
  ```
- **Verification:** Collector now starts cleanly and executes discovery sweeps continuously at 100 PPS without errors.

---

### DEF-002: Next.js Frontend Multi-Stage Build Failure
- **Severity:** High (P1) - Image build failure
- **Component:** `apps/web/Dockerfile`
- **Symptom:** Docker image build failed at step `COPY --from=builder /app/public ./public` with `failed to compute cache key: "/public" not found`.
- **Root Cause:** The `apps/web/public/` directory was absent from the rebuilt repository structure.
- **Remediation:** Created `apps/web/public/robots.txt` establishing the static asset directory.
- **Verification:** `watchnet-web` Docker image built cleanly and container started in standalone mode.

---

### DEF-003: Database Seed Script Model Keyword Argument Mismatch
- **Severity:** Medium (P2) - Database seeding failure
- **Component:** `scripts/seed_data.py`, `app/models/site.py`
- **Symptom:** `TypeError: 'subnet_cidrs' is an invalid keyword argument for Site`.
- **Root Cause:** `Site` model schema defines `description: str`, whereas `scripts/seed_data.py` attempted to pass `subnet_cidrs=["192.168.1.0/24"]`.
- **Remediation:** Corrected `scripts/seed_data.py` to instantiate `Site` with `description="Main network site"`.
- **Verification:** `scripts/seed_data.py` successfully seeded organizations, sites, admin user, 7 devices, probe targets, and alerts.

---

### DEF-004: Missing Configuration Attribute `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
- **Severity:** Medium (P2) - API runtime error
- **Component:** `services/api/app/core/config.py`, `services/api/app/api/v1/auth.py`
- **Symptom:** `AttributeError: 'Settings' object has no attribute 'JWT_ACCESS_TOKEN_EXPIRE_MINUTES'`.
- **Root Cause:** Configuration class defined `ACCESS_TOKEN_EXPIRE_MINUTES`, but auth router referenced `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`.
- **Remediation:** Added `JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24` alias in `app/core/config.py`.
- **Verification:** Settings loaded without attribute lookup failures.

---

### DEF-005: JWT Encoding Serialization Failure with UUID Objects
- **Severity:** Critical (P0) - Authentication broken
- **Component:** `services/api/app/api/v1/auth.py`, `services/api/app/core/user_auth.py`
- **Symptom:** `POST /api/v1/auth/token` returned HTTP 500 with `TypeError: Object of type UUID is not JSON serializable`.
- **Root Cause:** `auth.py` passed `user.id` and `user.organization_id` as raw `uuid.UUID` objects in `data`. The `python-jose` library calls `json.dumps()` internally, which does not serialize UUID instances by default.
- **Remediation:** 
  1. Updated `auth.py` to explicitly stringify UUIDs: `str(user.id)`, `str(user.organization_id)`.
  2. Hardened `create_access_token` in `user_auth.py` with defensive type coercion:
     `to_encode[k] = str(v) if isinstance(v, uuid.UUID) else v`.
- **Verification:** Token generation succeeded; valid signed JWT returned.

---

### DEF-006: Token Response Schema Missing Required Identity Claims
- **Severity:** High (P1) - Authentication endpoint response validation failure
- **Component:** `services/api/app/schemas/auth.py`, `services/api/app/api/v1/auth.py`
- **Symptom:** `pydantic_core.ValidationError: 4 validation errors for Token: user_id, organization_id, email, role (Field required)`.
- **Root Cause:** The `Token` Pydantic model requires identity claims for frontend session initialization, but `auth.py` only returned `access_token` and `token_type`.
- **Remediation:** Updated `login_for_access_token` return statement:
  ```python
  return Token(
      access_token=access_token,
      token_type="bearer",
      user_id=user.id,
      organization_id=user.organization_id,
      email=user.email,
      role=user.role,
  )
  ```
- **Verification:** Endpoint returned full `Token` JSON payload with HTTP 200 OK.

---

### DEF-007: Async SQLAlchemy `MissingGreenlet` Exception on Device Relationships
- **Severity:** Critical (P0) - Core device inventory API failure
- **Component:** `services/api/app/models/device.py`, `services/api/app/services/device_service.py`
- **Symptom:** `GET /api/v1/devices` returned HTTP 500 with `fastapi.exceptions.ResponseValidationError: MissingGreenlet: greenlet_spawn has not been called; can't call await_() here.`
- **Root Cause:** Pydantic serialization traversed `device.ip_addresses` and `device.custom_links`. Under SQLAlchemy 2.0 with `asyncpg`, lazy-loading triggers greenlet errors unless relationships are explicitly eagerly loaded or configured for async selectin loading.
- **Remediation:**
  1. Added `lazy="selectin"` to all relationship definitions on `Device` in `app/models/device.py`.
  2. Added `selectinload(Device.ip_addresses)`, `selectinload(Device.custom_links)`, and `selectinload(Device.tags)` in `DeviceService.list_devices()`.
- **Verification:** `GET /api/v1/devices` returns HTTP 200 OK with all 10 device objects and nested interfaces/IP arrays.

---

### DEF-008: Swagger UI Assets Blocked by Strict Caddy CSP Header
- **Severity:** Medium (P2) - API documentation styling blocked
- **Component:** `infrastructure/caddy/Caddyfile`
- **Symptom:** Browser console logged CSP errors: `Loading the stylesheet 'https://cdn.jsdelivr.net/...' violates directive 'style-src self'`.
- **Root Cause:** Caddy injected a restrictive default Content-Security-Policy that prevented FastAPI's Swagger UI from fetching its CDN assets.
- **Remediation:** Updated `Content-Security-Policy` header in `Caddyfile` to permit `https://cdn.jsdelivr.net` for `script-src` and `style-src`.
- **Verification:** Chrome verification re-run showed Swagger UI rendered in full color and styling with zero CSP violations.

---

### DEF-009: Playwright Strict Mode Violation on Search Inputs
- **Severity:** Low (P3) - Automated browser verification flakiness
- **Component:** `scripts/verify_chrome_app.py`
- **Symptom:** Playwright failed with `strict mode violation: locator("input[placeholder*='Search']") resolved to 2 elements`.
- **Root Cause:** Both the global topbar and the device table contain search inputs matching the wildcard selector.
- **Remediation:** Targeted the device table search box with `.last`.
- **Verification:** Chrome test script completed all 8 routes and interactions with exit code 0.

---

### DEF-010: Database Row-Level Security (RLS) Unapplied
- **Severity:** High (P1) - Multi-tenant isolation at database layer
- **Component:** `infrastructure/enable_rls.sql`, `watchnet-postgres`
- **Symptom:** `pg_tables` reported `rowsecurity = f` across all 25 application tables.
- **Root Cause:** Tables were generated via SQLAlchemy DDL which does not emit Postgres-specific `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements by default.
- **Remediation:** Authored `infrastructure/enable_rls.sql` to grant least-privilege permissions to `watchnet_app`, enable RLS across all 25 tables, and install `tenant_isolation_policy` checking `current_setting('app.current_tenant_id', true)::uuid`.
- **Verification:** Cross-tenant verification proved Tenant A queries return 10 records, Tenant B queries return 0 records, and unauthenticated queries return 0 records.

---

## 3. Defect Status Summary

| Defect ID | Severity | Description | Fix Location | Status |
| :--- | :---: | :--- | :--- | :---: |
| DEF-001 | P0 | Collector crash loop | `docker-compose.yml` | **VERIFIED** |
| DEF-002 | P1 | Next.js build missing public dir | `apps/web/public/` | **VERIFIED** |
| DEF-003 | P2 | Seed script argument mismatch | `scripts/seed_data.py` | **VERIFIED** |
| DEF-004 | P2 | Config missing JWT expiry alias | `app/core/config.py` | **VERIFIED** |
| DEF-005 | P0 | JWT encoding UUID type error | `app/api/v1/auth.py` | **VERIFIED** |
| DEF-006 | P1 | Token response schema missing claims | `app/api/v1/auth.py` | **VERIFIED** |
| DEF-007 | P0 | SQLAlchemy async MissingGreenlet | `app/models/device.py` | **VERIFIED** |
| DEF-008 | P2 | Swagger UI CSP blocking | `infrastructure/caddy/Caddyfile` | **VERIFIED** |
| DEF-009 | P3 | Playwright search locator conflict | `scripts/verify_chrome_app.py` | **VERIFIED** |
| DEF-010 | P1 | Postgres RLS unapplied | `infrastructure/enable_rls.sql` | **VERIFIED** |

