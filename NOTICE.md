# Legal Notice & Upstream Attribution

**Project:** WatchNet  
**License:** GNU General Public License v3.0 (GPL-3.0)  

---

## 1. Upstream Attribution

WatchNet is an independent, clean-room architectural reimplementation and functional replacement for **WatchNet**:
- **Upstream Repository:** https://github.com/watchnet/WatchNet
- **Original Authors & Contributors:** jokob-sk and the WatchNet / Pi.Alert open-source communities.
- **Upstream License:** GNU General Public License v3.0 (GPL-3.0).

WatchNet expresses deep gratitude to jokob-sk and the WatchNet project contributors for defining the state-of-the-art open-source home network monitoring workflows, plugin ecosystem concepts, and community hardware integrations.

---

## 2. Clean-Room Architectural Separation

While WatchNet ensures strict functional and configuration parity across all 56 WatchNet plugin capabilities and schema concepts, the WatchNet codebase has been re-engineered cleanly from first principles:
- Upstream PHP 8, vanilla jQuery, and unindexed flat SQLite implementations are completely removed from the production runtime.
- Replaced by asynchronous FastAPI (Python 3.12+), Next.js 15+ (React 19, TypeScript), Go-based raw network collectors, and PostgreSQL 16+ with partitioned audit tables.
- All code within this repository is governed by the GPL-3.0 license in accordance with upstream copyleft obligations.

---

## 3. Third-Party Software & Libraries

WatchNet incorporates or links against the following open-source libraries:
- **FastAPI / Starlette / Pydantic** (MIT License) - Asynchronous web framework and schema validation.
- **SQLAlchemy & Alembic** (MIT License) - SQL toolkit and schema migration engine.
- **Next.js & React** (MIT License) - Frontend rendering engine and component library.
- **Tailwind CSS & shadcn/ui** (MIT License) - Design token framework and accessible primitives.
- **TanStack Table** (MIT License) - High-performance virtualized datatables.
- **Recharts** (MIT License) - SVG charting primitives.
- **Redis Client (redis-py)** (MIT License) - Realtime cache and event broker interface.
- **Gopacket / Raw Sockets** (BSD-style) - Low-level packet capture and protocol parsing.
