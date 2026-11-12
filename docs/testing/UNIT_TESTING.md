# WatchNet Unit Testing Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Frameworks:** `pytest` (Backend / Python), `testing` (Collector / Go), `vitest` (Frontend / TypeScript)  
**Target Coverage:** >85% branch and line coverage across domain logic  

---

## 1. Architectural Scope & Unit Testing Principles

Unit testing in WatchNet focuses on pure, isolated business logic without requiring external network connections, live databases, or running Docker containers:
1. **Deterministic Execution:** Zero reliance on wall-clock time; all time-dependent logic (schedules, lease expiration, timeouts) uses frozen time fixtures (`freezegun` in Python, synthetic clocks in Go).
2. **Hermetic Test Environments:** In-memory mocks replace network sockets, subprocess executions, and file I/O.
3. **High Speed & Concurrency:** Unit test suites execute in under 15 seconds locally, running parallelized across CPU cores via `pytest-xdist`.

```mermaid
flowchart LR
    A[Unit Test Runner] --> B[Domain Logic / Parsers / State Machines]
    B --> C[Mock Interfaces / Test Doubles]
    C -.->|No Real Network / No Real DB| D[Pure Memory State]
    B --> E{Assertions}
    E -->|Pass| F[Fast CI Feedback (<15s)]
```

---

## 2. Critical Unit Test Domains

### 2.1 Backend Domain Logic (`services/api/`)
- **Password & Token Crypto:** Bcrypt hashing verification, JWT claims parsing, expired token rejection.
- **Parental Schedule State Machine:** Testing complex recurrence rules (e.g. overnight schedules spanning midnight, weekend vs weekday variations).
- **Zero-Flood Alert Suppressor:** Testing sliding window deduplication algorithm with rapid synthetic event bursts.
- **Anti-SSRF Validator:** Unit tests verifying regex and IP parsing for private CIDR ranges, IPv6 mapped IPv4, and DNS rebinding protections.

### 2.2 Go Collector Domain Logic (`collector/`)
- **ARP Packet Serializer & Deserializer:** Testing binary packet parsing against RFC 826 specifications.
- **Ring Buffer Eviction Policy:** Verifying that a full in-memory buffer evicts the oldest observation and preserves memory boundaries.
- **MAC Address Canonicalizer:** Parsing IEEE 802 formats (`00-11-22-33-44-55`, `0011.2233.4455`, `0:11:22:33:44:55`) into canonical `00:11:22:33:44:55`.

### 2.3 Frontend Utilities (`apps/web/`)
- **Heatmap Rollup Calculators:** Verifying math for 24-slot online percentage calculations.
- **Signal Quality Mappings:** Converting dBm integers to qualitative levels (Excellent, Good, Fair, Poor).

---

## 3. Example Reference Unit Test (FastAPI Service)

```python
import pytest
from src.services.anti_flood import AlertDeduplicator

def test_alert_deduplication_sliding_window():
    dedup = AlertDeduplicator(window_seconds=300)
    key = ("org_1", "site_1", "dev_1", "DEVICE_DOWN")

    # First event passes through immediately
    assert dedup.should_dispatch(key, timestamp=1000) is True

    # Second event 30s later is suppressed
    assert dedup.should_dispatch(key, timestamp=1030) is False

    # Third event 120s later is suppressed
    assert dedup.should_dispatch(key, timestamp=1120) is False

    # Fourth event 301s later (window expired) passes through
    assert dedup.should_dispatch(key, timestamp=1301) is True
```

---

## 4. Test Execution Commands

```bash
# Backend unit tests
pytest services/api/tests/unit -v -n auto

# Collector unit tests
go test -v -race ./collector/internal/...

# Frontend unit tests
pnpm --filter @watchnet/web test:unit
```
