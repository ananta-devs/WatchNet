# WatchNet — Modern Network Intelligence & Device Monitoring Platform

[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8.svg)](https://golang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

**WatchNet** is a high-performance, self-hosted network intelligence, infrastructure monitoring, and transparent device telemetry platform. It provides real-time layer-2 through layer-7 discovery, active presence tracking, hardware-agnostic router integrations, and automated alert routing.

---

## 🚀 Key Features

- **Automated Network Discovery**: Layer-2 ARP sweep, ICMP probing, DHCP lease extraction, and DNS hostname resolution.
- **Real-Time Telemetry & Presence**: Continuous tracking of online/offline status, IP change tracking, and historical session logs.
- **Enterprise Slate + Signal Blue UI**: Sleek, professional interface designed with Next.js 16 (App Router), Tailwind CSS v4, and dynamic Light/Dark/System theme engine.
- **Hardware-Agnostic Router Support**: Connects to OpenWrt, AsusWRT, FRITZ!Box, MikroTik, UniFi, and standard gateways.
- **Multi-Channel Alert Dispatcher**: Integrated alert routing supporting Webhooks, Apprise, Discord, Slack, Telegram, Pushover, and Email.
- **DNS & Family Safety Observability**: Integrates with Pi-hole and AdGuard Home for domain block telemetry and consent-based filtering.
- **High-Performance Architecture**: Asynchronous Python FastAPI backend, modular Go collector daemon, and optimized PostgreSQL + Redis data pipeline.
- **100% Cross-Platform & Containerized**: Ready to deploy anywhere using Docker Compose, or run locally across Linux, macOS, and Windows.

---

## 📂 Repository Structure

```
WatchNet/
├── backend/            # FastAPI async REST API & WebSocket service
│   ├── alembic/        # Database migrations
│   ├── app/            # Application logic, models, services & endpoints
│   └── tests/          # Pytest automated test suite
├── collector/          # Go discovery daemon & network prober
│   ├── cmd/            # Collector entrypoint
│   └── internal/       # Network engines (ARP, ICMP, DHCP, DNS)
├── frontend/           # Next.js 16 React Web UI
│   ├── src/app/        # App Router pages & layouts
│   └── e2e/            # Playwright end-to-end browser tests
├── docker/             # Dockerfiles & production compose configurations
├── docs/               # Architecture guides, API specs, and operational manual
│   └── user-guide/     # Complete User Operational Guide
├── .env.example        # Environment configuration template
└── README.md           # Project documentation
```

---

## ⚡ Quick Start

### 1. Clone the Repository

```bash
git clone https://www.github.com/ananta-devs/Watchnet.git
cd Watchnet
```

---

### Option A: Running with Docker (Recommended)

#### Prerequisites
- [Docker Engine & Docker Compose](https://docs.docker.com/get-docker/)

#### Steps
1. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
2. Start the full application stack (PostgreSQL, Redis, Backend, and Frontend):
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```
3. Access the application in your browser:
   - **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
   - **Backend API & Swagger Docs:** [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)

---

### Option B: Running Locally (Development Mode)

#### 1. Start Dependencies (PostgreSQL & Redis)
You can start just PostgreSQL and Redis using Docker:
```bash
docker compose -f docker/docker-compose.yml up -d postgres redis
```

#### 2. Start the Backend API (FastAPI)
```bash
cd backend

# Setup Python virtual environment
python -m venv venv

# Activate virtual environment:
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 3. Start the Frontend Web UI (Next.js)
Open a new terminal:
```bash
cd frontend

# Install Node dependencies
npm install

# Start development server
npm run dev
```

The Web UI will be live at [http://localhost:3000](http://localhost:3000).

---

## 🔐 Default Login Credentials

- **Login URL:** [http://localhost:3000/login](http://localhost:3000/login)
- **Username / Email:** `admin` (or `admin@watchnet.local`)
- **Password:** `admin123`

---

## 🧪 Testing

### Backend Tests (Pytest)
```bash
cd backend
python -m pytest tests
```

### Frontend Linting & Build
```bash
cd frontend
npm run lint
npm run build
```

---

## 📖 Documentation & Guides

Comprehensive documentation is provided in the [`docs/`](./docs) directory:
- [User Operational & How-To Guide](docs/user-guide/USER_OPERATIONAL_GUIDE.md)
- [Architecture & Design Specifications](docs/architecture/features/00_MASTER_ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

---

## 📄 License & Attribution

This project is licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).
See [NOTICE.md](NOTICE.md) for full upstream attribution and copyright notices.
