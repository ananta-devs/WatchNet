# Changelog

All notable changes to the WatchNet project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-rc.2] - 2026-11-14

### Independent Project Rebrand & GitHub Publication Readiness
- **Independent Project Identity**:
  - Rebranded the platform identity to standalone **WatchNet** across all user-facing interfaces, settings, service docstrings, and tests.
  - Sanitized backend backup engine (`backup_service.py`) and API routes (`system.py`) to expose standard CSV import/export without legacy branding.
  - Retained strict upstream open-source attribution in `NOTICE.md` and `LICENSE` (GPL-3.0) guaranteeing full intellectual property and copyleft compliance.
- **Repository Hygiene & GitHub Publishing Readiness**:
  - Added authoritative root `.gitignore` sanitizing environment secrets, database files, binary pycache artifacts, and test execution reports.
  - Untracked legacy compiled Python bytecode (`*.pyc`) and temporary test results (`playwright-report.json`) from version control.
  - Validated clean-room state of protected upstream repositories (`D:\WatchNet-Legacy-Baseline`, `D:\WatchNet-Reference-Snapshot`, `D:\WatchNet`).
- **Audit & Verification**:
  - Delivered comprehensive publication audit report in `docs/GITHUB_PUBLICATION_READINESS_REPORT.md`.
  - Frontend lint (`npm run lint`) passed with 0 errors.
  - Frontend production build (`npm run build`) succeeded with all 25 static & streaming routes generated.
  - Backend automated test suite (pytest) passed 100% (47 passed / 0 failed).

---

## [1.0.0-rc.1] - 2026-11-12

### Release Candidate v1.0.0 Packaging & Verification
- **Router Integration Levels**: Added explicit 4-tier integration taxonomy (ull_api, 
ead_only_api, passive_discovery, unsupported) in ackend/app/models/routers.py, ackend/app/api/v1/routers.py, and frontend /routers.
- **Telemetry Capability Profile**: Dynamic reporting of available and disabled telemetry metrics per router vendor and firmware constraints.
- **Upstream Plugin Reconciliation**: Fully reconciled all 56 upstream plugin directories against actual filesystem (server/plugins/), detailing category subtotals and 36 modular clean-room adapters with zero capability loss.
- **Release Documentation**: Authored RELEASE_NOTES_RC_1.0.0.md, INSTALLATION_GUIDE_RC_1.0.0.md, UPGRADE_GUIDE_RC_1.0.0.md, KNOWN_LIMITATIONS_RC_1.0.0.md, COMPATIBILITY_MATRIX.md, RELEASE_CANDIDATE_ACCEPTANCE_REPORT.md, RELEASE_CANDIDATE_PERFORMANCE_BASELINE.md, and RELEASE_CANDIDATE_CHROME_VERIFICATION.md.
- **Release Versioning**: Unified application version to 1.0.0-rc.1 across backend config, OpenAPI schema, frontend UI header, package.json, and release documentation.

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
  - All 56 legacy upstream plugins and 9 core platform modules validated and updated to `ACCEPTED` in `FEATURE_PARITY_MATRIX.md`.
  - Master Directive completion criteria (Phases 0 through 11) fully satisfied and marked `ACCEPTED`.

---

## [Unreleased]

### Comprehensive Responsive UI/UX Across All Breakpoints (2026-11-14)
- **Responsive Global Application Shell (`Shell.tsx`)**:
  - Implemented collapsible desktop/tablet navigation sidebar with state persistence (`watchnet_sidebar_collapsed`).
  - Implemented slide-in mobile navigation drawer with touch gesture backdrop, 44px touch targets, safe-area offsets, and Escape key accessibility.
  - Added full keyboard accessibility and body scroll locking (`useScrollLock`).
- **Responsive Table Transformations (`/devices`)**:
  - TanStack tabular inventory seamlessly transforms into high-density structured cards on mobile viewports (< 768px).
  - Maintained column sorting, searching, multi-select, and bulk batch actions across mobile, tablet, and desktop views.
- **Interactive Topology Zoom & Pan (`/topology`)**:
  - Added responsive zoom controls (+15%, -15%, Reset) and touch-friendly node inspection drawer.
- **Monitoring & NOC Wallboard (`/monitoring`, `/monitoring/wallboard`)**:
  - Responsive trajectory bar graphs with internal scroll preservation.
  - Flexible NOC wallboard layout with adaptive typography and fullscreen mode.
- **Touch-Friendly Controls Across Modules**:
  - Router vendor telemetry (`/routers`), DNS activity stream (`/activity`), Family Safety parental controls (`/family-safety`), and Workflow Builder (`/workflows`).
- **Visual Evidence Matrix**:
  - Automated Playwright suite verified zero horizontal overflow across 12 target viewports (320px, 360px, 375px, 390px, 414px, 640px, 768px, 1024px, 1280px, 1366px, 1920px, 2560px).
  - Screenshot evidence stored under `docs/testing/manual/responsive/`.

### Enterprise Slate + Signal Blue Design System
- **Centralized CSS Design Tokens**: Established authoritative tokens in `frontend/src/app/globals.css` mapping `--background`, `--surface`, `--sidebar`, `--accent`, `--accent-hover`, `--text`, `--muted`, `--border`, `--hover`, and semantic status tokens directly to Tailwind CSS `@theme inline`.
- **ThemeContext & Reactive System Theme**: Added robust `light | dark | system` theme toggle with `window.matchMedia` dynamic listener, early script anti-flash execution, and `watchnet_theme` localStorage persistence.
- **Enterprise Shell Overhaul**: Modernized desktop navigation sidebar and topbar with segmented theme switcher (`Light`, `Dark`, `System`), Signal Blue active states, and persistent user profile display.
- **Full Application Tokenization**: Cleanly refactored all 18 primary sections + Login screen, NOC Wallboard, and Device details to eliminate decorative gradients and inconsistent slates in favor of clean enterprise density and subtle 1px borders.
- **Automated Visual Verification**: Created `capture_theme_screenshots.spec.ts` capturing 40 high-resolution Light and Dark viewport screenshots into `docs/testing/manual/ui-theme/`.
- **100% E2E Pass Rate**: Successfully passed all 43 Playwright browser tests and verified 0 ESLint errors.


### Added
- **Phase 0: Legacy Upstream Repository Inspection & Snapshot Verification**:
  - Validated clean-room state of `D:\WatchNet-Legacy-Baseline`.
  - Created 100% bit-for-bit reference snapshot at `D:\WatchNet-Reference-Snapshot` with SHA-256 manifests across 1,393 files.
  - Audited and documented all 56 upstream plugins, 81 Flask API endpoints, and 14 primary database tables.
- **Phase 1: Architecture & Complete Documentation Foundation**:
  - Full suite of 8 root documents (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, `NOTICE.md`, `ROADMAP.md`, `IMPLEMENTATION_STATUS.md`).
  - Project specification suite (`PROJECT_OVERVIEW.md`, `PROJECT_OBJECTIVES.md`, `FUNCTIONAL_REQUIREMENTS.md`, `NON_FUNCTIONAL_REQUIREMENTS.md`, `PRODUCT_SCOPE.md`, `FEATURE_PARITY_MATRIX.md`, `IMPLEMENTATION_PLAN.md`, `PHASE_TRACKER.md`, `ACCEPTANCE_CRITERIA.md`, `KNOWN_LIMITATIONS.md`).
  - Upstream analysis suite (`SOURCE_ANALYSIS.md`, `ARCHITECTURE_ANALYSIS.md`, `FEATURE_INVENTORY.md`, `PLUGIN_INVENTORY.md`, `DATABASE_ANALYSIS.md`, `API_ANALYSIS.md`, `SECURITY_ANALYSIS.md`, `WATCHNET_MIGRATION_STRATEGY.md`).
  - Architecture specifications with Mermaid diagrams (`SYSTEM_ARCHITECTURE.md`, `BACKEND_ARCHITECTURE.md`, `FRONTEND_ARCHITECTURE.md`, `COLLECTOR_ARCHITECTURE.md`, `DATABASE_ARCHITECTURE.md`, `EVENT_PROCESSING_ARCHITECTURE.md`, `PLUGIN_ARCHITECTURE.md`, `ROUTER_INTEGRATION_ARCHITECTURE.md`, `DNS_POLICY_ARCHITECTURE.md`, `MULTI_SITE_ARCHITECTURE.md`, `API_ARCHITECTURE.md`, `NETWORK_TOPOLOGY.md`).
  - Security suite (`SECURITY_ARCHITECTURE.md`, `AUTHENTICATION_AND_AUTHORIZATION.md`, `RBAC_MATRIX.md`, `TENANT_ISOLATION.md`, `SECRET_MANAGEMENT.md`, `DATA_ENCRYPTION.md`, `AUDIT_LOGGING.md`, `NETWORK_SCANNER_SECURITY.md`, `PRIVACY_AND_DATA_RETENTION.md`, `PARENTAL_CONTROL_PRIVACY.md`, `THREAT_MODEL.md`).
  - Integration documentation (`SUPPORTED_ROUTERS.md`, `ROUTER_COMPATIBILITY_MATRIX.md`, `DHCP_INTEGRATION.md`, `SNMP_INTEGRATION.md`, `PIHOLE_INTEGRATION.md`, `ADGUARD_INTEGRATION.md`, `UNIFI_INTEGRATION.md`, `HOME_ASSISTANT_INTEGRATION.md`, `NOTIFICATION_INTEGRATIONS.md`, `CUSTOM_PLUGIN_DEVELOPMENT.md`).
  - Comprehensive testing plan (`TESTING_STRATEGY.md`, `UNIT_TESTING.md`, `INTEGRATION_TESTING.md`, `API_TESTING.md`, `FRONTEND_TESTING.md`, `PLAYWRIGHT_TESTING.md`, `ROUTER_TESTING.md`, `NETWORK_DISCOVERY_TESTING.md`, `PARENTAL_CONTROL_TESTING.md`, `PERFORMANCE_TESTING.md`, `SECURITY_TESTING.md`, `MANUAL_TESTING_PLAN.md`, `FINAL_ACCEPTANCE_CHECKLIST.md`).
  - Deployment guides (`DEVELOPMENT_SETUP.md`, `WINDOWS_SETUP.md`, `DOCKER_SETUP.md`, `DOCKER_COMPOSE.md`, `ENVIRONMENT_VARIABLES.md`, `PRODUCTION_DEPLOYMENT.md`, `BACKUP_AND_RESTORE.md`, `UPGRADE_AND_MIGRATION.md`, `TROUBLESHOOTING.md`).
