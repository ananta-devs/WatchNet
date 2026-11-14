# WatchNet Architecture: Plugins Ecosystem & Modular Extensibility

## 1. Executive Summary & Capabilities
The **Plugins Subsystem** provides a sandboxed execution runtime for modular network integrations, vendor protocol parsers, and custom scanners. It features:
1. **100% Upstream NetAlertX Plugin Compatibility**: Fully models all upstream plugin contracts and execution hooks.
2. **Scheduled & On-Demand Execution**: Runs plugins on independent cron cadences or manual one-click triggers.
3. **Execution Isolation & Log Capture**: Tracks stdout, stderr, execution exit codes, and run durations in `plugin_execution_logs`.
4. **Dynamic Configuration Schema**: Supports JSON-based parameter definitions (API tokens, poll intervals, interface overrides) editable directly from the UI.

---

## 2. Plugin Lifecycle & Execution Pipeline

```mermaid
flowchart TD
    REGISTRY["PluginRegistry (Singleton)"] --> LOAD["Load Plugin Manifests (Python/Go)"]
    LOAD --> INIT["Register 20+ Core Upstream Plugins"]
    
    INIT --> SCHED["PluginScheduler Background Loop"]
    
    SCHED --> CHECK{"Is Cron Cadence Reached?<br/>(or User Clicked 'Run')"}
    CHECK -->|Wait| SCHED
    CHECK -->|Execute| RUNNER["Plugin Execution Sandbox"]

    RUNNER --> ENV["Prepare Isolated Environment Variables"]
    ENV --> EXEC["Execute Plugin Logic (Async Worker)"]
    
    EXEC --> LOGS["Capture stdout / stderr / Exit Code"]
    EXEC --> TELEMETRY["Capture Ingested Entities"]

    LOGS --> DB_LOG[(plugin_execution_logs)]
    TELEMETRY --> DB_MAIN[(devices, routers, monitoring)]
    
    DB_LOG --> UI_PLUGIN["Plugins Dashboard (/plugins)"]
```

---

## 3. Database Schema Design

### `plugins` Table
```sql
CREATE TABLE plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'discovery', 'monitoring', 'routers', 'notifications'
    description TEXT,
    version VARCHAR(20) NOT NULL,
    author VARCHAR(100),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_cron VARCHAR(50), -- e.g. '*/5 * * * *'
    config_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    config_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_run_status VARCHAR(20) -- 'success', 'failed', 'running'
);
```

### `plugin_execution_logs` Table
```sql
CREATE TABLE plugin_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    status VARCHAR(20) NOT NULL, -- 'success', 'failure'
    stdout_output TEXT,
    stderr_output TEXT,
    exit_code INTEGER
);
CREATE INDEX ix_plugin_logs_plugin_id ON plugin_execution_logs(plugin_id);
```

---

## 4. Sequence: Plugin Execution & Log Output Streaming

```mermaid
sequenceDiagram
    autonumber
    participant UI as Plugins UI (/plugins)
    participant API as FastAPI Backend (/api/v1/plugins)
    participant Scheduler as PluginScheduler
    participant Plugin as Target Plugin Process
    participant DB as PostgreSQL 16

    UI->>API: POST /api/v1/plugins/{id}/run
    API->>Scheduler: Dispatch immediate execution
    Scheduler->>DB: Record new log row (status='running')
    API-->>UI: 202 Accepted (Execution Started)
    
    Scheduler->>Plugin: Execute run() method
    Plugin-->>Scheduler: Return status code 0 & JSON payload
    Scheduler->>DB: UPDATE plugin_execution_logs (stdout, duration_ms, status='success')
    Scheduler->>DB: UPDATE plugins SET last_run_at=NOW(), last_run_status='success'
    
    UI->>API: GET /api/v1/plugins/{id}/logs
    API->>DB: Query latest execution logs
    DB-->>API: Return stdout & exit codes
    API-->>UI: Render live execution log drawer
```
