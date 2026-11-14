# WatchNet Implementation Plan

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Execution Roadmap:** Step-by-Step Delivery across Phases 0 to 11  

---

## 1. Architectural Strategy & Phased Delivery Model

The WatchNet rebuild follows a strict phased execution strategy designed to eliminate technical debt, ensure zero loss of WatchNet capabilities, and establish high-assurance family safety extensions.

```mermaid
gantt
    title WatchNet Rebuild Implementation Timeline
    dateFormat  YYYY-MM-DD
    section Foundation
    Phase 0: Upstream Inspection       :done, p0, 2026-11-12, 1d
    Phase 1: Architecture & Docs       :active, p1, 2026-11-12, 1d
    section Core Platform
    Phase 2: Core Platform & Auth      :p2, after p1, 3d
    Phase 3: Network Discovery Engine  :p3, after p2, 4d
    Phase 4: Device Intelligence       :p4, after p3, 3d
    section Intelligence & Safety
    Phase 5: Monitoring & Topology     :p5, after p4, 3d
    Phase 6: Complete Plugin Engine    :p6, after p5, 4d
    Phase 7: Notification Workflows    :p7, after p6, 2d
    Phase 8: API & Multi-Site Sync     :p8, after p7, 3d
    Phase 9: Router & Parental Safety  :p9, after p8, 4d
    section Hardening & Acceptance
    Phase 10: Production Hardening     :p10, after p9, 3d
    Phase 11: Real-World Testing & GA  :p11, after p10, 2d
```

---

## 2. Phase-by-Phase Deliverables & Verification Criteria

### Phase 0: Upstream Repository Inspection (Completed)
- Snapshot verified at `D:\WatchNet-Reference-Snapshot` with SHA-256 manifests.
- Analysis report generated: `PHASE_0_UPSTREAM_INSPECTION_REPORT.md`.

### Phase 1: Architecture and Documentation Foundation (Active)
- Complete technical specification across 77 documents covering all subsystems.
- Baseline `FEATURE_PARITY_MATRIX.md` with 56 legacy upstream plugins.

### Phase 2: Core Platform Foundation
- Initialize Next.js 15 App Router and FastAPI backend skeletons.
- Configure PostgreSQL 16 schema with Alembic and Redis event queues.
- Deliverable: Containers boot cleanly, user authentication and RBAC operational.

### Phase 3: Network Discovery Engine
- Implement Go collector daemon with raw socket ARP, ICMP, and mDNS capture.
- Implement `/api/v1/discovery/ingest` endpoint with HMAC payload verification.
- Deliverable: Discovered devices successfully ingest into PostgreSQL.

### Phase 4: Device Inventory and Historical Intelligence
- Implement device lifecycle tracking, attribute locking, IP history, and 24h heatmap.
- Deliverable: Device name locks persist across scans; IP shifts log audit entries.

### Phase 5: Monitoring and Network Visualization
- Implement synthetic ping/port monitors, internet speedtest, and SVG topology view.
- Deliverable: Live visual topology connects devices to switches and APs.

### Phase 6: Plugin and Integration Framework
- Implement modular Python plugin runner supporting all 56 cataloged plugins.
- Deliverable: All plugins execute within sandboxed processes with structured output.

### Phase 7: Notifications and Workflow Automation
- Implement Apprise dispatcher, Home Assistant MQTT, and anti-flood throttling.
- Deliverable: Device events trigger alerts without notification spam.

### Phase 8: API, External Integrations and Multi-Site
- Implement OpenAPI 3.1 REST routes, GraphQL endpoint, and remote sync hub.
- Deliverable: Remote collectors report data to primary hub via mTLS.

### Phase 9: Router Intelligence and Family Safety
- Implement `BaseRouterAdapter` (UniFi, OpenWrt, MikroTik) and DNS policy engines.
- Deliverable: Bedtime schedules and category blockings verified via DNS tests.

### Phase 10: Production Hardening
- Implement database backup/restore scripts, container security, and log rotation.
- Deliverable: Automated wipe and restore achieves 100% data parity.

### Phase 11: Real-World Manual Testing and Final Acceptance
- Execute `MANUAL_TESTING_PLAN.md` with physical network hardware and mobile devices.
- Deliverable: Signed acceptance checklist and final release candidate.
