# WatchNet Docker Compose Configuration

**Document Version:** 1.0.0  
**Topology:** Multi-Container Production Stack  

---

## 1. Standard Production `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: watchnet-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: watchnet
      POSTGRES_USER: watchnet
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - watchnet-internal

  redis:
    image: redis:7-alpine
    container_name: watchnet-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - watchnet-internal

  api:
    image: ghcr.io/watchnet/watchnet-api:latest
    container_name: watchnet-api
    restart: unless-stopped
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql+asyncpg://watchnet:${POSTGRES_PASSWORD}@postgres:5432/watchnet
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      WATCHNET_SECRET_KEY: ${WATCHNET_SECRET_KEY}
    networks:
      - watchnet-internal
    ports:
      - "8000:8000"

  collector:
    image: ghcr.io/watchnet/watchnet-collector:latest
    container_name: watchnet-collector
    restart: unless-stopped
    network_mode: host
    cap_add:
      - NET_RAW
      - NET_ADMIN
    environment:
      API_INGEST_URL: http://127.0.0.1:8000/api/v1/collectors/report
      COLLECTOR_TOKEN: ${COLLECTOR_TOKEN}

  ui:
    image: ghcr.io/watchnet/watchnet-ui:latest
    container_name: watchnet-ui
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    ports:
      - "3000:3000"
    networks:
      - watchnet-internal

volumes:
  postgres_data:
  redis_data:

networks:
  watchnet-internal:
    driver: bridge
```
