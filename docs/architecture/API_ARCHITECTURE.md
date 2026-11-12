# WatchNet API Architecture

**Document Version:** 1.0.0  
**Specification:** OpenAPI 3.1 / RESTful / JSON / SSE  
**Authentication:** JWT Bearer / API Key Headers  

---

## 1. API Architecture & Standards

The WatchNet API is built on FastAPI adhering to strict RESTful conventions:
- **Consistent Response Formats**: Uniform envelope for all JSON responses:
  ```json
  {
    "success": true,
    "data": {},
    "error": null,
    "timestamp": "2026-11-12T10:00:00Z"
  }
  ```
- **Type Safety**: 100% of request and response payloads are validated using Pydantic v2 schemas.
- **Pagination**: Consistent cursor and offset pagination across collection endpoints (`limit`, `offset`, `cursor`).

---

## 2. Core API Endpoints

### 2.1 Devices
- `GET /api/v1/devices`: Paginated list of devices with query filters (`status`, `vendor`, `type`, `search`).
- `GET /api/v1/devices/{id}`: Detailed device metadata, open ports, and connection history.
- `PATCH /api/v1/devices/{id}`: Update device attributes (display name, type, notes, alert flags).
- `DELETE /api/v1/devices/{id}`: Delete or archive device.

### 2.2 Network & Diagnostics
- `POST /api/v1/diagnostics/ping`: Execute ICMP reachability check against target.
- `POST /api/v1/diagnostics/portscan`: Execute TCP port probe against target.
- `POST /api/v1/diagnostics/speedtest`: Trigger asynchronous internet speedtest.
- `POST /api/v1/devices/{id}/wakeonlan`: Broadcast Wake-on-LAN magic packet.

### 2.3 Streaming
- `GET /api/v1/stream/events`: Live Server-Sent Events stream for network events.
