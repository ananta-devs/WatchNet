# NetAlertX API Analysis

**Document Version:** 1.0.0  
**Baseline Snapshot:** `D:\NetAlertX-Reference-Snapshot` (`server/api_server/`)  
**Target Platform:** WatchNet FastAPI REST & SSE Architecture  

---

## 1. Upstream API Architecture

NetAlertX serves API requests through a Python Flask application (`server/api_server/api_server_start.py`) configured with:
- **REST Endpoints**: Endpoints returning JSON payloads for device queries, settings modification, and manual scan triggers.
- **GraphQL Endpoint**: Single endpoint (`/graphql`) powered by Graphene-Python for querying devices, events, and settings.
- **Server-Sent Events (SSE)**: Streaming endpoints (`/api/stream/log`) delivering live backend log output to the frontend.

---

## 2. API Endpoint Inventory

| HTTP Method | Route | Description | Upstream Handler |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/devices` | Returns list of all network devices with status | Flask route `get_devices()` |
| `GET` | `/api/device/<mac>` | Returns detailed properties for a single device | Flask route `get_device()` |
| `POST` | `/api/device/<mac>/update` | Updates device name, type, icon, or alert flags | Flask route `update_device()` |
| `DELETE`| `/api/device/<mac>` | Deletes device record and associated history | Flask route `delete_device()` |
| `GET` | `/api/events` | Retrieves paginated historical events | Flask route `get_events()` |
| `GET` | `/api/sessions` | Retrieves historical connection sessions | Flask route `get_sessions()` |
| `POST` | `/api/scan/trigger` | Manually triggers an immediate network scan | Shell execution wrapper |
| `GET` | `/api/settings` | Retrieves global configuration parameters | Flask route `get_settings()` |
| `POST` | `/api/settings` | Persists modified configuration keys | Flask route `set_settings()` |
| `GET` | `/api/plugins` | Returns registered plugins and active status | Dynamic filesystem scan |
| `POST` | `/api/plugins/<id>/run`| Executes an individual plugin on demand | Subprocess execution |
| `POST` | `/graphql` | GraphQL query/mutation execution | Graphene GraphQL executor |
| `GET` | `/api/stream/log` | Server-Sent Event stream for live system logs | Flask response generator |

---

## 3. Upstream Deficiencies

1. **Lack of Authentication**: API endpoints in default installations lack mandatory token-based authentication or request signing.
2. **Blocking Operations**: Network scans and plugin executions triggered via REST endpoints execute synchronously or block Flask worker threads.
3. **No Request Validation**: Input parameters lack schema validation (no Pydantic or OpenAPI specifications), leaving endpoints open to invalid inputs.
4. **GraphQL Overhead**: The GraphQL layer is sparsely used yet adds substantial dependency overhead and complexity.

---

## 4. WatchNet Modern API Specification

WatchNet implements an asynchronous REST API using FastAPI:
- Strict Pydantic v2 data models for 100% type-safe request validation and response serialization.
- Fully auto-generated OpenAPI 3.1 interactive documentation (`/docs` and `/redoc`).
- JWT-based Bearer token authentication with Role-Based Access Control (RBAC).
- Asynchronous task queuing using Celery and Redis for long-running operations.
- Native SSE and WebSocket endpoints for low-latency live telemetry and presence updates.
