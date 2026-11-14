# Contributing to WatchNet

Thank you for your interest in contributing to WatchNet! WatchNet is a modern, high-performance network monitoring, device intelligence, and family safety platform designed to replace WatchNet with 100% feature parity.

---

## 1. Clean-Room Implementation & Upstream Licensing Rules

WatchNet is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.
- **Legacy Upstream Respect**: Any ideas, schema mappings, or behavioral algorithms referenced from [WatchNet](https://github.com/watchnet/WatchNet) must maintain full copyright attribution in `NOTICE.md` and module docstrings.
- **Clean Architecture**: Do not import legacy PHP scripts, obsolete SQLite shell scripts, or vulnerable raw SQL execution patterns. Rebuild all functionality cleanly in FastAPI (Python), Next.js (TypeScript), and Go.
- **Traceability Requirement**: Every new PR implementing a feature or plugin must map directly to an entry in `docs/project/FEATURE_PARITY_MATRIX.md`.

---

## 2. Code Standards and Tooling

### Backend (Python / FastAPI)
- Formatted using `ruff format` and linted with `ruff check`.
- Static typing is mandatory; code must pass `mypy --strict`.
- Async database transactions via SQLAlchemy 2.0 with caller-owned transactions.
- Zero raw SQL string execution; use SQLAlchemy Core / ORM or parameter-bound queries.

### Frontend (Next.js / TypeScript)
- Strict TypeScript configuration (`noImplicitAny`, `strictNullChecks`).
- UI styling exclusively with Tailwind CSS v4 and shadcn/ui.
- Linted using `pnpm lint` (ESLint 9+) and formatted with Prettier.

### Collector (Go)
- Formatted with `gofmt` and linted with `golangci-lint`.
- Must respect network interface namespaces and least-privilege capability execution.

---

## 3. Pull Request Guidelines

1. **Phase Alignment**: Contributions must align with the active milestone in `docs/project/PHASE_TRACKER.md`.
2. **Automated Tests Required**: No feature PR will be accepted without unit tests (`pytest` for backend, `vitest` for frontend) and Playwright integration tests where UI is touched.
3. **Documentation Updates**: Any change affecting configuration, API routes, or plugin contracts must update the corresponding file in `/docs`.
4. **Conventional Commits**: Commit messages must follow the Conventional Commits specification (e.g., `feat(api): add ARP lease parsing`, `fix(collector): handle vlan tagged frames`).
