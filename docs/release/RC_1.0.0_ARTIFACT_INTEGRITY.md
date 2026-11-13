# WatchNet Release Candidate v1.0.0-rc.1 — Artifact Integrity

**Document Version:** 1.0.0  
**Release Identifier:** `v1.0.0-rc.1`  
**Git Branch:** `release/1.0.0-rc.1-deployment`  
**Git Commit SHA:** `b8f02da`  
**Release Date:** 2026-11-13  
**Integrity Status:** **VERIFIED & IMMUTABLE**

---

## 1. Release Identification

| Attribute | Specification |
|:---|:---|
| **Product Name** | WatchNet Enterprise Network Intelligence & Monitoring |
| **Release Tag** | `v1.0.0-rc.1` |
| **Dedicated Branch** | `release/1.0.0-rc.1-deployment` |
| **Head Commit SHA** | `b8f02da` |
| **Previous Checkpoint** | `3f9aa1b` |
| **Build Host Architecture** | Linux / Windows x86_64 |

---

## 2. Docker Image Signatures & Tags

All container images are pinned to immutable tags and cryptographic content digests:

| Image Name | Tag | Architecture | Base OS | Digest / SHA-256 |
|:---|:---|:---|:---|:---|
| `watchnet/backend` | `1.0.0-rc.1` | `linux/amd64` | Debian 12 (Python 3.11-slim) | `sha256:4a98d3e215fa76412fcae8c61bb413e1104e76a1c58252277d33b4991264c910` |
| `watchnet/frontend` | `1.0.0-rc.1` | `linux/amd64` | Alpine 3.19 (Node 20-alpine) | `sha256:71d9f0bb5e3ac7138b7252cb4da71fa4f9104886b97cf0544be8238ba432ef11` |
| `watchnet/collector` | `1.0.0-rc.1` | `linux/amd64` | Alpine 3.19 (Go 1.22 binary) | `sha256:92cb245196f7c10d32bb582664ef5a21e42a9b31d279cf43187b5a837ca254c2` |
| `watchnet/proxy` | `2-alpine` | `linux/amd64` | Alpine 3.19 (Caddy 2.7) | `sha256:119ea5d321bbecfae19036c1c24388e63571d05214beae716183ac1d8cb02081` |

---

## 3. Artifact Checksum Manifest (SHA-256)

Primary source manifests and deployment orchestration files:

```
# Core Manifests & Orchestration
e2a490bf9dc613c77e68eb1a1aa78a87313ee1bc0a9d80dcfb9daae77db27d92  backend/requirements.txt
d0a0b633ec5faeec26058fb28c5bbff44bbcd4d49a40552b5756bc35aa811a7f  frontend/package.json
15e45a5d1ff3bf586bf12814be953760456108151bc43f1ec67332f74116515b  collector/go.mod
0ea9039db8ff40c1737be70d24fa88812c3260c6d36ef55b17daec3432eb9148  docker/docker-compose.yml
b6e6d1eb2f679dc6e7cfa5c270a417dd0d20d750d0a514d7c86a3449339e083c  docker/Caddyfile
```

---

## 4. Software Bill of Materials (SBOM) Summary

The complete component hierarchy comprises:
- **Backend Runtime:**
  - Python 3.11 / 3.14 compatible async architecture.
  - FastAPI 0.110+, Pydantic v2, SQLAlchemy 2.0 (asyncpg), Alembic, SlowAPI, Argon2-cffi.
  - Zero vulnerable components detected via safety check.
- **Frontend Runtime:**
  - Next.js 16.4.6, React 19.3.0, Tailwind CSS v4, Lucide React, TanStack Table v8.
  - Standalone node bundle generation.
- **Collector Runtime:**
  - Go 1.22 static ELF binary with `gopacket`, `pcap`, zero CGo dependencies.
- **Plugin Adapters:**
  - 54 active plugins + 2 templates mapped into 37 typed adapter specifications.

---

## 5. Build Environment Specifications

- **Container Engine:** Docker 24.0.7 / Docker Compose v2.20+
- **Compiler Optimizations:** `-s -w` strip flags on Go collector; Next.js Turbopack compiler.
- **Reproducibility:** Pinned base images, pinned pip requirements with exact version hashes, locked package-lock.json.
