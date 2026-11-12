# WATCHNET: POST-ACCEPTANCE ADVANCED DEVELOPMENT PROPOSAL

**Document ID:** PROP-ADV-2026-01  
**Current Baseline:** WatchNet Rebuild v1.0.0 (NetAlertX Feature Parity & Security Verified)  
**Governance Notice:** Strictly a planning proposal for human evaluation. **Implementation of downstream phases (Phase 15/16+) is NOT authorized** until formal human acceptance and separate instruction.  

---

## 1. Context & Motivation

With the successful execution of **WATCHNET-REBUILD-002**, WatchNet has established:
1. Complete functional and architectural superiority over legacy NetAlertX baselines.
2. Production-grade multi-tenant architecture with PostgreSQL Row-Level Security (RLS).
3. Modern frontend (Next.js 14 App Router + Tailwind CSS) and backend (FastAPI async engine + Go 1.22 packet collector).
4. Full interactive testability, verified in Google Chrome, with 100% data retention and disaster recovery validation.

The purpose of this proposal is to outline prioritized technological trajectories for future phases once formal human sign-off of Rebuild v1.0.0 is concluded.

---

## 2. Proposed Strategic Capabilities

### Capability 1: High-Performance eBPF Passive Network Profiler
- **Rationale:** While the current Go collector employs raw sockets (`AF_PACKET`) for active ARP/ICMP sweeps and basic sniffing, an eBPF (Extended Berkeley Packet Filter) probe running in Linux kernel space would enable zero-overhead passive network profiling.
- **Key Enhancements:**
  - Zero-copy TCP handshake analysis for instantaneous SYN-ACK fingerprinting without active port scanning.
  - TLS ClientHello passive fingerprinting (JA3 / JA4) to identify device operating systems, client software, and headless bots with 99%+ accuracy.
  - Continuous DNS query monitoring to detect malicious domain resolution (DGA, tunneling, C2 beacons).

---

### Capability 2: AI-Powered Infrastructure Incident Correlation & Anomaly Embeddings
- **Rationale:** WatchNet's PostgreSQL 16 database includes the `pgvector` extension. This foundation can be harnessed to power autonomous telemetry correlation without brittle threshold alerts.
- **Key Enhancements:**
  - Embedding generation for network events, presence shifts, and probe latency spikes.
  - Vector similarity clustering to group correlated anomalies across switches, APs, and endpoints into a single actionable incident.
  - Natural Language diagnostic summaries generated via local LLM or approved enterprise inference endpoints.

---

### Capability 3: Active Rogue Quarantine & Network Access Control (NAC)
- **Rationale:** Detection of rogue devices or unauthorized MAC address cloning requires automated or 1-click remediation.
- **Key Enhancements:**
  - Managed switch port isolation via SNMP v3 / SSH CLI (e.g. Cisco, Aruba, Ubiquiti UniFi, MikroTik).
  - Dynamic VLAN reassignment (moving untrusted devices into an isolated quarantine VLAN).
  - 802.1X / RADIUS integration to revoke authentication tokens upon policy violation or rogue DHCP detection.

---

### Capability 4: Multi-Cluster Distributed Edge Mesh Orchestration
- **Rationale:** Large enterprise enterprises operate hundreds of remote branch offices, retail locations, and cloud VPCs.
- **Key Enhancements:**
  - Lightweight edge collector binaries with mutual TLS (mTLS) authentication and certificate auto-rotation.
  - Raft-based distributed consensus across edge collectors for high-availability leader election in redundant LAN segments.
  - Compressed, encrypted telemetry delta streaming with local SQLite edge buffering during WAN outages.

---

## 3. Implementation Phasing & Resource Matrix

| Proposed Track | Focus Area | Complexity | Target Architecture |
| :--- | :--- | :---: | :--- |
| **Track A: Kernel & Edge Telemetry** | eBPF probes & passive JA4 fingerprinting | High | Linux C / Go eBPF (cilium/ebpf) |
| **Track B: Vector Intelligence** | pgvector incident clustering & local LLM | Medium | Python / FastAPI / pgvector |
| **Track C: Active Remediation** | Switch port shutdown & RADIUS quarantine | Medium | Go / SNMPv3 / Paramiko |
| **Track D: Enterprise Fleet Mesh** | Multi-collector mTLS & edge mesh consensus | High | Go / gRPC / HashiCorp Serf |

---

## 4. Governance & Prerequisites for Authorization

1. **Human Acceptance:** Formal review and sign-off on `REBUILD_002_FINAL_ACCEPTANCE_REPORT.md` and `HUMAN_TESTER_CHECKLIST.md`.
2. **Phase Authorization:** Explicit human prompt authorizing subsequent engineering phases.
3. **Clean-Room Adherence:** Continued enforcement of clean-room design standards and strict open-source license compliance.

