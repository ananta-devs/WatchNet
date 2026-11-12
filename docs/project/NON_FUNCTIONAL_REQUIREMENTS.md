# WatchNet Non-Functional Requirements Specification

**Document Version:** 1.0.0  
**Classification:** System Architecture Guarantees  

---

## 1. Performance & Scalability (NFR-PERF)

- **NFR-PERF-01 (Scan Throughput)**: The Go network collector shall complete an active Layer-2/Layer-3 sweep of a /24 subnet (254 addresses) within 1.5 seconds.
- **NFR-PERF-02 (Database Concurrency)**: The PostgreSQL data layer shall support continuous write ingestion of at least 500 transaction records/sec without read starvation or table locks.
- **NFR-PERF-03 (UI Virtualization)**: The device inventory table shall render 5,000+ devices with virtual scrolling at 60 FPS without DOM degradation.
- **NFR-PERF-04 (Memory Footprint)**: The backend API service shall operate within < 250 MB RAM under nominal idle state; the Go collector shall consume < 45 MB RAM.

---

## 2. Security & Compliance (NFR-SEC)

- **NFR-SEC-01 (Authentication)**: All administrative and user endpoints shall enforce Argon2id password verification, cryptographically signed JWT tokens, and secure HttpOnly SameSite cookies.
- **NFR-SEC-02 (Zero Raw SQL Injection)**: No client endpoint shall accept arbitrary SQL query strings. All database queries must be compile-time validated via SQLAlchemy 2.0 ORM or parameterized prepared statements.
- **NFR-SEC-03 (Privilege Separation)**: The Go collector daemon shall run with explicit Linux capabilities (CAP_NET_RAW, CAP_NET_ADMIN) rather than full root access.
- **NFR-SEC-04 (Data Encryption)**: Sensitive configuration parameters, router passwords, and API tokens stored in the database shall be encrypted at rest using AES-256-GCM.
- **NFR-SEC-05 (Audit Logging)**: All administrative actions (device edits, policy updates, configuration changes) shall be recorded in an immutable append-only audit log.

---

## 3. Reliability & Availability (NFR-REL)

- **NFR-REL-01 (Crash Resilience)**: Unhandled errors or network timeouts in external router adapters or notification publishers shall be trapped with exponential backoff and never terminate the main process.
- **NFR-REL-02 (Database Integrity)**: Caller-owned nested transactions shall be enforced; partial database writes on failed scans must be cleanly rolled back.
- **NFR-REL-03 (Data Retention Partitioning)**: Time-series event tables (events, sessions, presence_history) shall be partitioned monthly to allow instantaneous drop-based data pruning.

---

## 4. Maintainability & Portability (NFR-MAINT)

- **NFR-MAINT-01 (Clean Architecture)**: Strict separation of concerns between Data Access, Domain Logic, Service Layer, and API Transport.
- **NFR-MAINT-02 (Containerization)**: The entire platform shall deploy via multi-stage Dockerfiles and a single docker-compose.yml supporting AMD64 and ARM64 architectures.
- **NFR-MAINT-03 (Developer Tooling)**: Standardized linting (ruff, mypy, eslint), formatting (ruff format, prettier), and automated tests runnable via PowerShell or Makefile.
