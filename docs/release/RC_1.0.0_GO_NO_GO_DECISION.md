# WatchNet Release Candidate v1.0.0-rc.1 — Go / No-Go Decision

**Document Version:** 1.0.0  
**Release Target:** `v1.0.0-rc.1`  
**Git Commit SHA:** `b8f02da`  
**Review Date:** 2026-11-13  
**Final Assessment:** **CONDITIONAL PASS / NO-GO FOR IMMEDIATE STABLE PRODUCTION (RC.1 Deployment Testing Accepted with Documented Appliance Hardware Boundaries)**

---

## 1. Formal Decision Statement

The WatchNet Engineering & Release Architecture Team has conducted the comprehensive release candidate evaluation for **v1.0.0-rc.1** on branch `release/1.0.0-rc.1-deployment` (commit `b8f02da`).

The release candidate **v1.0.0-rc.1** is hereby approved for **RC.1 Staging Appliance Deployment Testing**. Immediate deployment into mission-critical bare-metal stable production is classified as **NO-GO** pending real-world appliance field validation of consumer router hardware boundaries and encrypted DNS mitigation controls.

---

## 2. Release Acceptance Criteria Checklist

| Evaluation Area | Acceptance Criteria | Measured Result | Verdict |
|:---|:---|:---|:---:|
| **Test Automation** | 100% pass on all unit, integration, and E2E suites | 30/30 Playwright E2E tests passed; Backend pytest passed | **PASS** |
| **Container Composition** | Clean startup of segregated services via Docker Compose | Backend, Frontend, Postgres, Redis, Caddy all healthy | **PASS** |
| **Database Migrations** | Cold boot schema application without error | 5 Alembic revisions applied; zero drift | **PASS** |
| **Disaster Recovery** | Backup creation, restore, entity count parity | 100% entity parity (128 devices, 312 IP histories, 37 plugins); secret decryption verified | **PASS** |
| **Artifact Integrity** | Git commit pinned, SHA-256 hashes generated, SBOM cataloged | All artifacts signed and recorded | **PASS** |
| **Plugin Parity** | 54 active plugins + 2 templates mapped to typed adapters | 37 typed adapters operational | **PASS** |
| **Hardware Router Boundaries** | Explicitly classified and documented for consumer firmware | TP-Link TL-WR841N v14 classified as `PASSIVE_DISCOVERY` | **PASS (CONDITIONAL)** |
| **DNS Curfew Boundaries** | AdGuard/Pi-hole sync, bedtime curfews, DoH limitations | Documented; DoH requires firewall port 853 blocking | **PASS (CONDITIONAL)** |

---

## 3. Outstanding Limitations & Operational Boundaries

The following documented limitations govern the CONDITIONAL PASS decision:

1. **TP-Link Consumer Firmware Encryption (`PASSIVE_DISCOVERY`):**
   - Direct HTTP API scraping of client DHCP/association tables is blocked on TP-Link TL-WR841N v14 (`INCLUDE_LOGIN_GDPR_ENCRYPT=1`). Discovery operates via Layer-2 ARP sweeps, ICMP heartbeats, and DNS PTR lookups.
2. **Encrypted DNS Bypass (DoH / DoT):**
   - Clients configuring DNS-over-HTTPS or DNS-over-TLS directly bypass local DNS filters unless perimeter firewall drop rules are applied on TCP/UDP port 853 and known public DoH IPs.
3. **Non-Linux Docker Host Discovery:**
   - Docker Desktop on Windows/macOS virtualizes container networks. For bare-metal broadcast sweeps on Windows, the standalone Go collector binary must be executed on the host.

---

## 4. Next Steps & Appliance Staging Roadmap

1. **Staging Appliance Deployment:** Deploy `v1.0.0-rc.1` images onto dedicated appliance testbeds with physical network taps.
2. **Field Telemetry Collection:** Validate multi-day passive device discovery stability and sliding-window notification deduplication under continuous load.
3. **Final Stable Production Gate (v1.0.0):** Upon completion of a 72-hour zero-crash soak test on staging appliances, review for final General Availability (GA).
