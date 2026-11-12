# WatchNet Environment Variables Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Applicability:** Docker Compose, Kubernetes, Local `.env` Configuration  

---

## 1. Environment Variable Architecture & Standards

WatchNet follows the 12-factor application methodology: all configuration is injected via environment variables. Configuration keys are strictly typed using Pydantic `BaseSettings` models in the FastAPI backend and validated at application bootstrap.

---

## 2. Comprehensive Configuration Reference

### 2.1 Core Application & Security Settings
| Variable Name | Type | Default | Description |
|---|---|---|---|
| `WATCHNET_ENV` | `string` | `production` | Environment tier: `development`, `test`, `production` |
| `SECRET_KEY` | `string` | *Required* | 256-bit cryptographically random key for JWT signing |
| `ENCRYPTION_MASTER_KEY` | `string` | *Required* | Base64-encoded 32-byte AES-256 key for column-level encryption |
| `JWT_ALGORITHM` | `string` | `HS256` | JWT signing algorithm (`HS256`, `RS256`, `EdDSA`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `int` | `60` | Lifespan of user session access tokens |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `int` | `14` | Lifespan of long-lived refresh tokens |
| `LOG_LEVEL` | `string` | `INFO` | Console logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

### 2.2 Database (PostgreSQL 16) Settings
| Variable Name | Type | Default | Description |
|---|---|---|---|
| `POSTGRES_HOST` | `string` | `db` | Database hostname or IP address |
| `POSTGRES_PORT` | `int` | `5432` | Database port |
| `POSTGRES_DB` | `string` | `watchnet` | Application database name |
| `POSTGRES_USER` | `string` | `watchnet` | Unprivileged application database user |
| `POSTGRES_PASSWORD` | `string` | *Required* | Database user password |
| `POSTGRES_POOL_SIZE` | `int` | `20` | SQLAlchemy connection pool size |
| `POSTGRES_MAX_OVERFLOW` | `int` | `10` | Max overflow connections allowed above pool size |

### 2.3 Cache & Event Broker (Redis / Valkey) Settings
| Variable Name | Type | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | `string` | `redis` | Redis hostname |
| `REDIS_PORT` | `int` | `6379` | Redis port |
| `REDIS_PASSWORD` | `string` | `""` | Redis auth password |
| `REDIS_DB` | `int` | `0` | Redis logical database index |

### 2.4 Collector & Discovery Engine Settings
| Variable Name | Type | Default | Description |
|---|---|---|---|
| `COLLECTOR_SECRET_KEY` | `string` | *Required* | Shared secret for signing HMAC ingest payloads |
| `COLLECTOR_SWEEP_INTERVAL` | `int` | `30` | Seconds between active network discovery sweeps |
| `COLLECTOR_TARGET_SUBNET` | `string` | `auto` | CIDR subnet to probe (e.g., `192.168.1.0/24`) |
| `COLLECTOR_MOCK_DISCOVERY` | `bool` | `false` | Enable synthetic traffic generator for dev without raw sockets |
| `ENABLE_DEEP_PORT_SCAN` | `bool` | `true` | Enable periodic port sweeps on discovered devices |

---

## 3. Template Configuration File (`.env.example`)

```dotenv
# --- Security & Core ---
WATCHNET_ENV=production
SECRET_KEY=change_this_to_a_secure_random_hex_string_64_chars
ENCRYPTION_MASTER_KEY=change_this_to_base64_encoded_32_byte_aes_key
LOG_LEVEL=INFO

# --- Database ---
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=watchnet
POSTGRES_USER=watchnet
POSTGRES_PASSWORD=super_secret_db_password_here
POSTGRES_POOL_SIZE=20

# --- Redis ---
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# --- Collector ---
COLLECTOR_SECRET_KEY=change_this_to_matching_collector_ingest_secret
COLLECTOR_SWEEP_INTERVAL=30
COLLECTOR_TARGET_SUBNET=auto
```
