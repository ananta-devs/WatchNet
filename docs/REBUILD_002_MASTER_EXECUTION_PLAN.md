# WatchNet Rebuild 002 — Master Execution Plan
## Functional Verification, WatchNet Parity, Security, Reliability & Human Testing Readiness

**Task ID:** WATCHNET-REBUILD-002  
**Workspace:** `D:\WatchNet`  
**Reference Benchmark:** `D:\WatchNet-Legacy-Baseline` (GNU GPLv3 Reference)  
**Execution Sequence:** STEP 0 (Plan) → STEP 1 (Functional & Chrome) → STEP 2 (Security) → STEP 3 (Parity Closure) → STEP 4 (Human Testing) → STEP 5 (Proposal)

---

## 1. Execution Stages & Task Breakdown

### Stage 0: Inspection & Planning (Complete)
- **PLAN-001:** Full workspace and backup integrity check (`D:\WatchNet_backup_20261112_130000`).
- **PLAN-002:** Reference codebase feature analysis (`D:\WatchNet-Legacy-Baseline`).
- **PLAN-003:** Author `REBUILD_002_INITIAL_BASELINE.md`, `REBUILD_002_FEATURE_GAP_REGISTER.md`, and this Master Plan.

---

### Stage 1: Full Functional Verification and Implementation
The goal is to prove that WatchNet functions end-to-end as a live running product, not merely compiled source code.

- **FEV-001: Live Docker Stack Startup & Health Verification**
  - Launch PostgreSQL 16, Redis 7, FastAPI backend, Go collector, Next.js frontend, and Caddy 2 via Docker Compose.
  - Verify all health checks pass and no recurring error loops exist in logs.
  - *Dependencies:* Docker Engine, `infrastructure/docker-compose.yml`.
  - *Acceptance Criteria:* All 6 containers running, healthy, and communicating.

- **FEV-002: Seed Data & Database Initialization**
  - Implement automated seed script populating default tenant organization, site, admin user, realistic network devices, and sample alerts.
  - *Dependencies:* FEV-001.
  - *Acceptance Criteria:* Database contains clean verifiable seed records.

- **FEV-003: Chrome Browser Manual & Automated Interaction**
  - Launch Google Chrome and navigate through the running application.
  - Test every major route: Dashboard (`/`), Devices (`/devices`), Presence (`/presence`), Topology (`/topology`), Diagnostics (`/diagnostics`), Integrations (`/integrations`).
  - Click every visible interactive button, run search/filters, test dialogs, and inspect console logs for errors.
  - Capture visual screenshots in `docs/rebuild/evidence/REBUILD_002/`.
  - *Dependencies:* FEV-001, FEV-002.
  - *Acceptance Criteria:* Zero fatal JS errors; forms and interactive buttons produce expected state changes.

- **FEV-004: Network Discovery Verification in Isolated Network**
  - Test Go Collector sweep in isolated test network against known container IPs.
  - Verify ARP/TCP sweep, mDNS queries, NetBIOS queries, and local buffer queuing.
  - Verify batch delivery to `/api/v1/discovery/ingest`.
  - *Dependencies:* FEV-001, FEV-002.
  - *Acceptance Criteria:* Collector observations ingest into PostgreSQL and update device timestamps.

- **FEV-005: Device Inventory Lifecycle & Attribute Locking**
  - Test device creation, hostname updates, IP history logging, attribute locking, and multi-interface assignment.
  - *Dependencies:* FEV-002.
  - *Acceptance Criteria:* Locked fields resist automated sweep overwrites; IP changes produce historical audit entries.

- **FEV-006: Availability Monitoring & 24h Presence Heatmap**
  - Test synthetic ICMP, TCP port, and HTTP checks.
  - Verify hourly aggregation rollups and 24-slot presence heatmap rendering.
  - *Dependencies:* FEV-001, FEV-003.
  - *Acceptance Criteria:* Accurate calculation of online minutes and percentage across 24 hourly slots.

- **FEV-007: Notification Delivery & Zero-Flood Throttling**
  - Test Apprise delivery and Home Assistant MQTT auto-discovery payload publishing.
  - Simulate rapid alert triggers to verify 5-minute deduplication throttling.
  - *Dependencies:* FEV-001.
  - *Acceptance Criteria:* First alert dispatched, subsequent identical alerts deduplicated without spam.

- **FEV-008: External Appliance & SDN Connectors**
  - Test UniFi, Omada, Pi-hole, and AdGuard client importers using local test doubles.
  - *Dependencies:* FEV-001.
  - *Acceptance Criteria:* Clean JSON parsing, error handling on bad credentials, and device inventory synchronization.

- **FEV-009: Interactive Diagnostics Workbench**
  - Test on-demand Ping, Port Scan, Wake-on-LAN, and Traceroute from the web console.
  - *Dependencies:* FEV-003.
  - *Acceptance Criteria:* Interactive tools execute asynchronously and render results in the console terminal.

- **FEV-010: Database Persistence & Service Restart Recovery**
  - Restart API container, Redis container, and full Docker stack.
  - Verify records, sessions, and configurations survive restarts intact.
  - *Dependencies:* FEV-001, FEV-002.
  - *Acceptance Criteria:* 100% data retention after Docker stack restarts.

---

### Stage 2: Security & Reliability Implementation
- **SEC-001: Authentication & JWT Hardening**
  - Test password hashing (bcrypt), token expiration, invalid token rejection, and `/auth/me`.
- **SEC-002: Role-Based Access Control (RBAC)**
  - Verify authorization checks on privileged endpoints.
- **SEC-003: Cross-Tenant Row-Level Security (RLS) Enforcement**
  - Connect with unprivileged `watchnet_app` database role and attempt cross-tenant queries.
  - Verify that `SET LOCAL app.current_tenant_id` blocks Tenant B from querying Tenant A data.
- **SEC-004: Anti-SSRF Defense & IP Pinning**
  - Test attempts to target loopback (127.0.0.1), RFC1918 subnets, and AWS metadata (169.254.169.254).
- **SEC-005: Container & Non-Root Privilege Hardening**
  - Verify containers run as non-root unprivileged users and capabilities are constrained.
- **SEC-006: Failure Recovery & Offline Queue Drain**
  - Simulate API outage while collector runs; verify collector buffers observations and drains backlog upon recovery.
- **SEC-007: Backup & Restoration Validation**
  - Execute database dump, wipe, restore, and verify record count parity.

---

### Stage 3: WatchNet Feature Parity Closure
- **PAR-001:** Reconcile authoritative feature inventory against WatchNet docs.
- **PAR-002:** Map every capability to WatchNet implementation path.
- **PAR-003:** Implement missing/incomplete features identified in Gap Register.
- **PAR-004:** Update `WATCHNET_COMPLETE_FEATURE_INVENTORY.md` and `FEATURE_IMPLEMENTATION_MATRIX.md`.

---

### Stage 4: Human Testing Readiness
- **HTR-001:** Fix all discovered critical and high defects in `REBUILD_002_DEFECT_REGISTER.md`.
- **HTR-002:** Verify installation documentation and quickstart instructions.
- **HTR-003:** Author `HUMAN_TESTER_CHECKLIST.md` with step-by-step test instructions.
- **HTR-004:** Prepare repeatable test seed environment.

---

### Stage 5: Advanced Development Planning
- **ADP-001:** Author `NEXT_PHASE_PROPOSAL.md` outlining post-acceptance advanced capabilities.

---

## 2. Deliverables Matrix

| Deliverable Path | Description | Target Stage |
| :--- | :--- | :---: |
| `docs/rebuild/REBUILD_002_MASTER_EXECUTION_PLAN.md` | Master execution plan and task breakdown | Stage 0 |
| `docs/rebuild/REBUILD_002_INITIAL_BASELINE.md` | Current baseline assessment and test state | Stage 0 |
| `docs/rebuild/REBUILD_002_FEATURE_GAP_REGISTER.md` | Feature-by-feature implementation gap register | Stage 0 |
| `docs/rebuild/REBUILD_002_FUNCTIONAL_VERIFICATION_REPORT.md` | Live runtime and Chrome testing evidence | Stage 1 |
| `docs/rebuild/REBUILD_002_SECURITY_RELIABILITY_REPORT.md` | Security, RLS, SSRF, and backup verification | Stage 2 |
| `docs/rebuild/REBUILD_002_DEFECT_REGISTER.md` | Defect tracking and resolution log | Stage 4 |
| `docs/rebuild/HUMAN_TESTER_CHECKLIST.md` | Step-by-step testing guide for human evaluators | Stage 4 |
| `docs/rebuild/NEXT_PHASE_PROPOSAL.md` | Proposal for next development phase | Stage 5 |
| `docs/rebuild/REBUILD_002_FINAL_ACCEPTANCE_REPORT.md` | Comprehensive final acceptance record | Final |
| `docs/rebuild/evidence/REBUILD_002/*` | Screenshots, logs, HTTP captures, DB outputs | Continuous |

