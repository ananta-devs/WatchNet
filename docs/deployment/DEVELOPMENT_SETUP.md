# WatchNet Development Setup

**Document Version:** 1.0.0  
**Environment:** Linux / macOS / Windows (WSL2 / Native)  

---

## 1. Prerequisites

- **Python**: 3.12+ with `poetry` or `uv` package manager.
- **Node.js**: 20+ LTS with `pnpm`.
- **Go**: 1.22+ for the collector engine.
- **Docker & Docker Compose**: For local PostgreSQL 16 and Redis 7 instances.

---

## 2. Local Setup Instructions

```bash
# 1. Clone repository
git clone https://github.com/watchnet/watchnet.git watchnet
cd watchnet

# 2. Spin up local database and cache
docker compose up -d postgres redis

# 3. Setup backend
cd server
poetry install
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload --port 8000

# 4. Setup frontend
cd ../front
pnpm install
pnpm dev --port 3000
```
