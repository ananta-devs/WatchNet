# WatchNet Rebuild — Known Limitations & Architectural Scope

## 1. Clean-Room Architectural Boundaries

WatchNet was rebuilt from a clean slate to achieve complete functional parity with NetAlertX while eliminating its technical debt (SQLite write contention, monolithic script locks, single-tenant limitations, and unhardened subshell command injection risks).

The following operational considerations and scope boundaries are established:

### 1.1 Operating System & Network Privileges
- **Raw Socket Probes on Linux:** The Go Collector requires `CAP_NET_RAW` and `CAP_NET_ADMIN` capabilities to craft raw Ethernet ARP frames and bind to UDP port 68 for rogue DHCP detection without running as a root process.
- **Windows Collector Execution:** On Windows workstations without WinPcap/Npcap installed, the collector falls back automatically to high-concurrency TCP connect sweeping and ICMP subprocess checks.

### 1.2 Multi-Tenant RLS Scope
- Row-Level Security (RLS) is enforced via PostgreSQL session-pinned tenant IDs (`SET LOCAL app.current_tenant_id = :org_id`). When running tests against in-memory SQLite, RLS policies are simulated via SQLAlchemy query condition filters.

### 1.3 Governance Scope Constraints
- **Phase 15 / Phase 16 / Advanced Features:** Strictly NOT authorized. The codebase is exclusively scoped to core rebuild, clean-room feature parity with NetAlertX, operational resilience, and automated verification.
- **Production Publication:** Public registry publication is strictly not authorized per human governance directive.

