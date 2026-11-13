# WatchNet v1.0.0-rc.1 — Staging Burn-in Incident Register

**Document Identifier:** `WNET-DOC-BURNIN-INC-001`  
**Version:** 1.0.0-rc.1  
**Status:** ACTIVE REGISTER  
**Audit Period:** Staging Burn-in Initiation  

---

## 1. Incident Severity Definitions

All anomalies, faults, degradation events, and hardware blockers encountered during staging burn-in are classified into one of four severity tiers:

- **Severity 1 (Fatal / Blocker):** System crash, unhandled panic, data corruption, memory leak exceeding threshold, or failure to satisfy physical availability gates. Blocks release certification.
- **Severity 2 (Major):** Service degraded, secondary discovery protocol failure, temporary UI unresponsive ($> 5\text{s}$), or notification dispatch retry exhaustion.
- **Severity 3 (Minor):** Cosmetic logging anomaly, transient API timeout recovered on first retry, or single packet drop on noisy Wi-Fi link.
- **Severity 4 (Informational):** Scheduled restart test event, configuration update, or planned link flap simulation.

---

## 2. Master Incident Log

| Incident ID | Timestamp | Severity | Component | Summary & Root Cause | Impact | Resolution / Current Status |
|:---|:---:|:---:|:---|:---|:---|:---:|
| `INC-20261113-01` | 2026-11-13T13:40:00Z | **Sev 1** | Host Hardware Gate | **Host OS is Windows 11; bare-metal Linux appliance absent.** Development workstation (Intel i5-1235U, Win 11 Build 26100) cannot serve as official burn-in appliance per directive rules. | Prevents starting 72-hour continuous physical burn-in run. | **OPEN / BLOCKED:** Hardware gate failed. Burn-in held until bare-metal Linux hardware provisioned. |
| `INC-20261113-02` | 2026-11-13T13:42:00Z | **Sev 1** | Network / DNS Gate | **Physical AdGuard Home / Pi-hole instance absent on port 53.** Gateway `192.168.0.1` is standard ISP gateway proxy; port 53 queries forwarded upstream. | Live physical bedtime curfew and category blocking cannot be validated against hardware. | **OPEN / BLOCKED:** DNS gate failed. Unit/contract tests pass; live physical run held. |
| `INC-20261113-03` | 2026-11-13T08:50:00Z | **Sev 3** | Frontend E2E Suite | Playwright navigation timeout in `e2e/navigation.spec.ts` on slower CI container cold starts. | Caused intermittent E2E failure during RC.1 build validation. | **RESOLVED:** Fixed in commit `b1cc69d` by introducing explicit hydration state wait locator. |
| `INC-20261113-04` | 2026-11-13T08:45:00Z | **Sev 3** | Backend Pytest | Version assertion failure in `test_api_auth.py` checking legacy `0.1.0` instead of `1.0.0-rc.1`. | Test runner assertion error. | **RESOLVED:** Fixed in commit `b8f02da` with unified version registry check. |

---

## 3. Incident Sign-Off Summary

- **Total Fatal (Sev 1) Incidents:** 2 (Hardware Gate Blocked, DNS Sinkhole Blocked).
- **Total Major (Sev 2) Incidents:** 0.
- **Total Minor (Sev 3) Incidents:** 2 (Resolved).
- **Total Informational (Sev 4) Incidents:** 0.

**Release Impact:** In strict compliance with Condition 7 and Section 11 of the Master Directive, Sev 1 incidents `INC-20261113-01` and `INC-20261113-02` require that stable General Availability (`v1.0.0-stable`) be classified as **NO-GO**. The software is approved under **CONDITIONAL PASS** for Release Candidate 1 staging deployment testing only.
