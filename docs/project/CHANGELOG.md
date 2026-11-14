# WatchNet Changelog

All notable changes to the WatchNet platform are documented in this file.

## [Phase 1: Architecture & Documentation Foundation] - 2026-11-12

### Added
- Authored complete architecture decision records (`docs/adr/ADR_DECISIONS.md`).
- Authored system component topology and microservice specifications (`docs/architecture/SYSTEM_COMPONENTS.md`).
- Authored network discovery data-flow and state machine transition specs (`docs/architecture/DATA_FLOW_EVENT_MODEL.md`).
- Authored clean-room Plugin SDK and read-only Router Adapter specifications (`docs/plugins/PLUGIN_ROUTER_SPECIFICATION.md`).
- Authored PostgreSQL 16 schema, Row-Level Security (RLS) policies, and retention partitioning specs (`docs/database/DATABASE_ARCHITECTURE.md`).
- Authored authentication, RBAC authorization matrix, and privacy boundaries (`docs/architecture/AUTH_RBAC_PRIVACY.md`).
- Authored multi-site edge communication and DNS sinkhole policy specs (`docs/architecture/MULTISITE_DNS_POLICY.md`).
- Authored master Phase 1 Architecture Completion Report (`docs/project/PHASE_1_ARCHITECTURE_DOCUMENTATION_REPORT.md`).

## [Phase 0: Upstream Inspection & Preservation] - 2026-11-12

### Added
- Completed bit-for-bit SHA-256 validation of all 1,393 files between upstream source `D:\WatchNet-Legacy-Baseline` and reference snapshot `D:\WatchNet-Reference-Snapshot` (0 mismatches).
- Verified complete filesystem independence (zero shared hardlinks or NTFS junctions).
- Produced comprehensive upstream inspection report (`docs/project/PHASE_0_UPSTREAM_INSPECTION_REPORT.md`).
- Audited 56 legacy upstream plugins and 14 database tables.
- Cataloged full 54-capability traceability matrix (`docs/project/FEATURE_PARITY_MATRIX.md`).
