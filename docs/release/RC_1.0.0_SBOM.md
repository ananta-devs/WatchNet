# WatchNet Release Candidate v1.0.0-rc.1 — Software Bill of Materials (SBOM)

**Release:** `v1.0.0-rc.1`  
**Generated Date:** 2026-11-12  
**Format:** Markdown Specification conforming to SPDX 2.3 & CycloneDX Principles  
**Licensing Baseline:** GNU General Public License v3.0 (GPL-3.0)  

---

## 1. Upstream & Core Project Identification

| Component | Upstream Origin | Relationship | License | Notes |
|:---|:---|:---|:---|:---|
| **WatchNet** | https://github.com/watchnet/WatchNet | Predecessor / Concept Reference | GPL-3.0 | 54 active plugins re-implemented clean room |
| **WatchNet Core** | https://github.com/watchnet/watchnet | Derived Work (Clean-room rewrite) | GPL-3.0 | Modern FastAPI + Next.js + Go architecture |

---

## 2. Backend Dependencies (`backend/requirements.txt`)

| Package Name | Declared Version | Effective License | Security / Vulnerability Check |
|:---|:---|:---|:---|
| `fastapi` | `>=0.110.0` | MIT | Clean (No known CVEs) |
| `uvicorn[standard]` | `>=0.28.0` | BSD-3-Clause | Clean |
| `pydantic` | `>=2.6.0` | MIT | Clean |
| `pydantic-settings` | `>=2.2.0` | MIT | Clean |
| `sqlalchemy[asyncio]` | `>=2.0.28` | MIT | Clean |
| `alembic` | `>=1.13.1` | MIT | Clean |
| `asyncpg` | `>=0.29.0` | Apache-2.0 | Clean |
| `psycopg2-binary` | `>=2.9.9` | LGPL with linking exception | Clean |
| `redis` | `>=5.0.3` | MIT | Clean |
| `argon2-cffi` | `>=23.1.0` | MIT | Clean (Memory-hard password hashing) |
| `pyjwt[crypto]` | `>=2.8.0` | MIT | Clean (Cryptographic JWT tokens) |
| `slowapi` | `>=0.1.9` | MIT | Clean (Rate limiting) |
| `httpx` | `>=0.27.0` | BSD-3-Clause | Clean (Async HTTP client) |
| `apprise` | `>=1.7.4` | MIT | Clean (Multi-channel notifications) |
| `aiosqlite` | `>=0.20.0` | MIT | Clean (Test harness) |
| `pytest` | `>=8.1.0` | MIT | Test framework |
| `pytest-asyncio` | `>=0.23.5` | Apache-2.0 | Test runner |

---

## 3. Frontend Dependencies (`frontend/package.json`)

| Package Name | Declared Version | Effective License | Ecosystem Role |
|:---|:---|:---|:---|
| `next` | `16.4.6` | MIT | React Web Framework (Turbopack) |
| `react` | `19.2.0` | MIT | UI Component Model |
| `react-dom` | `19.2.0` | MIT | Web DOM Renderer |
| `lucide-react` | `^1.16.0` | ISC | Accessible UI iconography |
| `recharts` | `^3.7.0` | MIT | SVG charting & bandwidth visualization |
| `@tanstack/react-table`| `^8.21.3` | MIT | High performance datatables |
| `tailwindcss` | `^4.0.0` | MIT | Atomic CSS styling |
| `zod` | `^3.24.2` | MIT | Client runtime schema validation |
| `clsx` / `tailwind-merge` | `^2.1.1` / `^3.4.0` | MIT | Utility class merging |

---

## 4. Collector Daemon Dependencies (`collector/go.mod`)

| Go Module | Version | License | Role |
|:---|:---|:---|:---|
| `github.com/google/gopacket` | `v1.1.19` | BSD-3-Clause | Layer 2 raw frame parsing & capture |
| `github.com/redis/go-redis/v9` | `v9.5.1` | BSD-2-Clause | Event pub/sub client |
| `golang.org/x/net` | `v0.22.0` | BSD-3-Clause | Raw ICMP socket operations |
| `golang.org/x/sys` | `v0.18.0` | BSD-3-Clause | Linux kernel netlink & socket syscalls |

---

## 5. Licensing Compatibility Assertion

All direct and transitive runtime dependencies utilize permissive open-source licenses (MIT, BSD-2/3, Apache-2.0, ISC, or LGPL binary) fully compatible with the primary **GPL-3.0** copyleft license governing the WatchNet repository. No proprietary or conflicting non-commercial licenses exist.
