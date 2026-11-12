# WatchNet Project Objectives & Key Performance Indicators

**Document Version:** 1.0.0  
**Target Delivery:** Q1 2027  
**Quality Gate:** Zero-Defect Architecture Baseline  

---

## 1. Strategic Objectives

1. **100% NetAlertX Feature Parity**:
   - Re-implement all 56 upstream plugin capabilities or provide documented superseding implementations.
   - Maintain full backward compatibility for device importing, network monitoring metrics, and alert dispatch channels.
2. **Architectural Modernization & Reliability**:
   - Eliminate all PHP legacy runtime components and replace them with a unified TypeScript/Next.js and FastAPI stack.
   - Replace SQLite embedded storage with PostgreSQL 16+, eliminating lock contention crashes during intensive network scans.
   - Decouple device discovery from parental controls so DNS filter downtime never impacts network monitoring.
3. **Security Hardening by Design**:
   - Completely abolish upstream raw SQL injection vectors.
   - Implement Argon2id password hashing, HttpOnly secure cookie authentication, and granular RBAC.
   - Execute network sniffing with the principle of least privilege using dedicated Linux capabilities.
4. **Hardware & Router Independence**:
   - Provide an extensible adapter pattern allowing seamless addition of new router models and network gateways without modifying core business logic.
5. **Observability & Developer Experience**:
   - Provide auto-generated OpenAPI 3.1 documentation, asynchronous Server-Sent Events (SSE) for real-time UI updates, and containerized Docker Compose deployment.

---

## 2. Key Performance Indicators (KPIs)

| Metric | Target Goal | Upstream NetAlertX Baseline |
| :--- | :--- | :--- |
| **Concurrent Subnet Scan Time (/24)** | < 1.5 seconds | 8.5 seconds (sequential shell loop) |
| **Web UI Initial Page Load (LCP)** | < 0.8 seconds | 2.6 seconds (PHP bundle rendering) |
| **API Response Latency (P99)** | < 45 ms | 280 ms (SQLite file lock contention) |
| **Database Write Concurrency** | 500+ writes/sec without locking | Contention crashes at > 5 writes/sec |
| **Test Coverage (Core Domain)** | > 85% automated coverage | Limited unit tests (~15%) |
| **Hardware Discovery Parity** | 56 / 56 plugins mapped & tested | 56 plugins discovered in upstream |
