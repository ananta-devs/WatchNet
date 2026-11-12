# WatchNet Role-Based Access Control (RBAC) Matrix

**Document Version:** 1.0.0  
**Enforcement:** Application Service Layer & API Endpoint Dependencies  

---

## 1. Defined System Roles

1. **`SUPER_ADMIN`**: Global system administrator with multi-tenant oversight and cluster settings access.
2. **`TENANT_ADMIN`**: Household / organization owner with full control over devices, routers, DNS policies, and user accounts within their tenant.
3. **`OPERATOR`**: Technical user capable of running diagnostics, updating device names, and triggering network scans.
4. **`VIEWER`**: Read-only user permitted to view the dashboard, device list, and network topology.
5. **`RESTRICTED_FAMILY`**: Family member view with access limited to their assigned device group and parental status.

---

## 2. Permission Privilege Matrix

| Resource / Action | Endpoint / Operation | SUPER_ADMIN | TENANT_ADMIN | OPERATOR | VIEWER | RESTRICTED_FAMILY |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **View Devices** | `GET /api/v1/devices` | Yes | Yes | Yes | Yes | Self Only |
| **Modify Device Metadata** | `PATCH /api/v1/devices/{id}` | Yes | Yes | Yes | No | No |
| **Delete / Archive Device**| `DELETE /api/v1/devices/{id}`| Yes | Yes | No | No | No |
| **Run Diagnostics (Ping)** | `POST /api/v1/diagnostics/*`| Yes | Yes | Yes | No | No |
| **Trigger Immediate Scan** | `POST /api/v1/scan/trigger` | Yes | Yes | Yes | No | No |
| **Configure Routers** | `POST /api/v1/integrations/*`| Yes | Yes | No | No | No |
| **Manage DNS Policies** | `POST /api/v1/dns-policy/*` | Yes | Yes | No | No | No |
| **Manage Users & RBAC** | `POST /api/v1/users/*` | Yes | Yes | No | No | No |
| **System Backup & Restore**| `POST /api/v1/system/backup`| Yes | Yes | No | No | No |
| **Global System Config** | `POST /api/v1/admin/config` | Yes | No | No | No | No |
