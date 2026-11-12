# Authentication, Authorization & RBAC Matrix

**Document Version:** 1.0.0  

---

## 1. Authentication Architecture

WatchNet enforces stateless JWT-based authentication paired with cryptographic refresh tokens:
1. **User Login (`POST /api/v1/auth/login`):** Users submit credentials (email + password).
2. **Password Verification:** Passwords are encrypted using modern `Argon2id` / `bcrypt` algorithms with individual cryptographic salts.
3. **Token Issuance:** Successful authentication returns:
   - `access_token` (Short-lived: 15 minutes, HMAC-SHA256 signed, carries `tenant_id` and `role`).
   - `refresh_token` (Long-lived: 7 days, stored in HTTP-only, Secure, SameSite=Strict cookie).
4. **Tenant Context Binding:** On every incoming API request, FastAPI middleware extracts `tenant_id` from the verified JWT and sets `SET LOCAL app.current_tenant_id = '<tenant_id>'` on the active database connection.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Permission / Action | Super Admin | Tenant Admin | Security Analyst | Read-Only Viewer | Collector Agent |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Manage Global Tenants & Licenses** |  |  |  |  |  |
| **Invite & Manage Tenant Users** |  |  |  |  |  |
| **Configure Router Integrations** |  |  |  |  |  |
| **View Device Inventory & Topology** |  |  |  |  |  |
| **Trigger Diagnostic Scans (Ping/Nmap)**|  |  |  |  |  |
| **Send Wake-on-LAN Magic Packets** |  |  |  |  |  |
| **Edit Device Custom Attributes** |  |  |  |  |  |
| **View Security & Rogue Alerts** |  |  |  |  |  |
| **Submit Raw Network Observations** |  |  |  |  |  |
| **Export Database & Device CSV** |  |  |  |  |  |

---

## 3. Privacy Architecture & Parental-Control Subsystem Boundary

To protect network user privacy while enabling legitimate device inventory auditing:
1. **Separation of Concerns:** Network discovery and infrastructure monitoring are strictly isolated from parental control and DNS inspection subsystems.
2. **DNS Activity Clarification:** WatchNet documentation and UI strictly clarify that DNS query metrics from Pi-hole/AdGuard represent domain resolution activity and **do not constitute complete browser history** (omitting full URLs, paths, query parameters, and incognito encrypted sessions).
3. **MAC Address Masking:** An optional tenant privacy mode allows non-admin users to view anonymized device MAC addresses (e.g. `AA:BB:CC:**:**:**`).
