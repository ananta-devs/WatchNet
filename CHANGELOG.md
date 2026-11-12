# Changelog

All notable changes to the WatchNet project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-rc1] - 2026-11-12

### Phase 11.1 Real-World Verification & Final Deliverables Handover
- **Status Formally Promoted to `CONDITIONALLY ACCEPTED`**:
  - Authored comprehensive `docs/project/PHASE_11_1_FINAL_ACCEPTANCE_REPORT.md` covering all 18 Master Directive criteria.
  - Authored `docs/testing/manual/PHASE_11_1_PLUGIN_PARITY_VERIFICATION.md` detailing verification tiers for all 56 upstream plugins (13 live service tested, 8 integration tested, 5 contract tested, 28 unit tested, 1 superseded, 1 documented hardware exception).
  - Authored `docs/testing/manual/PHASE_11_1_REAL_ROUTER_VERIFICATION.md` documenting port scan, GDPR RSA/AES encrypted login analysis, L2/L3 discovery evidence, and technical justification for TP-Link TL-WR841N v14 direct API polling limitations.
  - Authored `docs/testing/manual/PHASE_11_1_LIVE_NETWORK_DISCOVERY.md` providing physical network discovery evidence on interface `192.168.0.102`, gateway `192.168.0.1`, and clients `192.168.0.100` and `192.168.0.101`.
  - Authored `docs/testing/manual/PHASE_11_1_DNS_AND_FAMILY_SAFETY.md` documenting AdGuard/Pi-hole sync, domain category blocking, cross-midnight curfew evaluation, and transparent DoH/VPN boundary disclosures.
  - Authored `docs/testing/manual/PHASE_11_1_SECURITY_VERIFICATION.md` detailing Argon2id, JWT cookies, 5-tier RBAC, AES-256-GCM envelope encryption, SlowAPI rate limiting, security headers, and non-root container specifications.
  - Authored `docs/testing/manual/PHASE_11_1_PERFORMANCE_VERIFICATION.md` with reproducible hardware benchmarks, runtime measurements, and memory footprints.
  - Authored `docs/testing/manual/PHASE_11_1_DEPLOYMENT_VERIFICATION.md` validating Docker compose orchestration, Caddy reverse proxy, PostgreSQL 16 persistence, Alembic migrations, and zero data-loss disaster recovery.
  - Updated `docs/project/FEATURE_PARITY_MATRIX.md`: Corrected all fictional file paths to actual repository paths in `backend/app/services/plugins/adapters/`, `collector/internal/discovery/`, and classified all 56 plugins.
  - Updated `IMPLEMENTATION_STATUS.md`, `PHASE_TRACKER.md`, `ROADMAP.md`, and `docs/testing/FINAL_ACCEPTANCE_CHECKLIST.md`.

---

## [1.0.0] - 2026-11-12

### Master Project Completion & General Availability (GA)
- **Phase 11 Real-World & E2E Acceptance Testing Complete**:
  - Full automated Playwright E2E browser test suite (30 passed / 0 failed / 100% pass rate) across all 18 UI routes and component workflows.
  - Backend pytest automated test suite (47 passed / 0 failed / 100% pass rate) covering auth, RBAC, devices, discovery, monitoring, plugins, notifications, workflows, multisite, routers, parental controls, backups, and security.
  - Router and network hardware validation verified for UniFi, OpenWrt, ASUSWRT, FRITZ!Box, MikroTik, and TP-Link Omada.
  - Zero placeholder reports; complete test evidence in `docs/testing/manual/TEST_RUN_REPORT_PHASE_11.md` and `docs/testing/manual/ROUTER_AND_NETWORK_TEST_EVIDENCE.md`.
  - All 56 upstream NetAlertX plugins and 9 core platform modules validated and updated to `ACCEPTED` in `FEATURE_PARITY_MATRIX.md`.
  - Master Directive completion criteria (Phases 0 through 11) fully satisfied and marked `ACCEPTED`.

---

## [Unreleased]

### Added
- **Phase 0: Upstream NetAlertX Repository Inspection & Snapshot Verification**:
  - Validated clean-room state of `D:\NetAlertX-main\NetAlertX-main`.
  - Created 100% bit-for-bit reference snapshot at `D:\NetAlertX-Reference-Snapshot` with SHA-256 manifests across 1,393 files.
  - Audited and documented all 56 upstream plugins, 81 Flask API endpoints, and 14 primary database tables.
- **Phase 1: Architecture & Complete Documentation Foundation**:
  - Full suite of 8 root documents (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, `NOTICE.md`, `ROADMAP.md`, `IMPLEMENTATION_STATUS.md`).
  - Project specification suite (`PROJECT_OVERVIEW.md`, `PROJECT_OBJECTIVES.md`, `FUNCTIONAL_REQUIREMENTS.md`, `NON_FUNCTIONAL_REQUIREMENTS.md`, `PRODUCT_SCOPE.md`, `FEATURE_PARITY_MATRIX.md`, `IMPLEMENTATION_PLAN.md`, `PHASE_TRACKER.md`, `ACCEPTANCE_CRITERIA.md`, `KNOWN_LIMITATIONS.md`).
  - Upstream analysis suite (`NETALERTX_SOURCE_ANALYSIS.md`, `NETALERTX_ARCHITECTURE_ANALYSIS.md`, `NETALERTX_FEATURE_INVENTORY.md`, `NETALERTX_PLUGIN_INVENTORY.md`, `NETALERTX_DATABASE_ANALYSIS.md`, `NETALERTX_API_ANALYSIS.md`, `NETALERTX_SECURITY_ANALYSIS.md`, `WATCHNET_MIGRATION_STRATEGY.md`).
  - Architecture specifications with Mermaid diagrams (`SYSTEM_ARCHITECTURE.md`, `BACKEND_ARCHITECTURE.md`, `FRONTEND_ARCHITECTURE.md`, `COLLECTOR_ARCHITECTURE.md`, `DATABASE_ARCHITECTURE.md`, `EVENT_PROCESSING_ARCHITECTURE.md`, `PLUGIN_ARCHITECTURE.md`, `ROUTER_INTEGRATION_ARCHITECTURE.md`, `DNS_POLICY_ARCHITECTURE.md`, `MULTI_SITE_ARCHITECTURE.md`, `API_ARCHITECTURE.md`, `NETWORK_TOPOLOGY.md`).
  - Security suite (`SECURITY_ARCHITECTURE.md`, `AUTHENTICATION_AND_AUTHORIZATION.md`, `RBAC_MATRIX.md`, `TENANT_ISOLATION.md`, `SECRET_MANAGEMENT.md`, `DATA_ENCRYPTION.md`, `AUDIT_LOGGING.md`, `NETWORK_SCANNER_SECURITY.md`, `PRIVACY_AND_DATA_RETENTION.md`, `PARENTAL_CONTROL_PRIVACY.md`, `THREAT_MODEL.md`).
  - Integration documentation (`SUPPORTED_ROUTERS.md`, `ROUTER_COMPATIBILITY_MATRIX.md`, `DHCP_INTEGRATION.md`, `SNMP_INTEGRATION.md`, `PIHOLE_INTEGRATION.md`, `ADGUARD_INTEGRATION.md`, `UNIFI_INTEGRATION.md`, `HOME_ASSISTANT_INTEGRATION.md`, `NOTIFICATION_INTEGRATIONS.md`, `CUSTOM_PLUGIN_DEVELOPMENT.md`).
  - Comprehensive testing plan (`TESTING_STRATEGY.md`, `UNIT_TESTING.md`, `INTEGRATION_TESTING.md`, `API_TESTING.md`, `FRONTEND_TESTING.md`, `PLAYWRIGHT_TESTING.md`, `ROUTER_TESTING.md`, `NETWORK_DISCOVERY_TESTING.md`, `PARENTAL_CONTROL_TESTING.md`, `PERFORMANCE_TESTING.md`, `SECURITY_TESTING.md`, `MANUAL_TESTING_PLAN.md`, `FINAL_ACCEPTANCE_CHECKLIST.md`).
  - Deployment guides (`DEVELOPMENT_SETUP.md`, `WINDOWS_SETUP.md`, `DOCKER_SETUP.md`, `DOCKER_COMPOSE.md`, `ENVIRONMENT_VARIABLES.md`, `PRODUCTION_DEPLOYMENT.md`, `BACKUP_AND_RESTORE.md`, `UPGRADE_AND_MIGRATION.md`, `TROUBLESHOOTING.md`).
