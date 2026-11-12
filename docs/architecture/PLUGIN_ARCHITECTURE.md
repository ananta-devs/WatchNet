# WatchNet Plugin Architecture

**Document Version:** 1.0.0  
**Design Pattern:** Typed Plugin Provider Contract  
**Execution Context:** Sandboxed Asynchronous Workers  

---

## 1. Plugin Architecture Overview

WatchNet transitions from unconstrained upstream Python/shell scripts directly accessing SQLite to a structured, type-safe plugin engine. All integrations implement standardized abstract base classes with defined life cycles.

---

## 2. Base Plugin Interface Contract

Every WatchNet plugin adheres to the `BasePlugin` interface:

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from pydantic import BaseModel

class PluginManifest(BaseModel):
    id: str
    name: str
    version: str
    category: str
    author: str
    description: str
    config_schema: Dict[str, Any]

class PluginExecutionResult(BaseModel):
    success: bool
    items_discovered: int
    data: Dict[str, Any]
    error_message: str | None = None

class BasePlugin(ABC):
    def __init__(self, manifest: PluginManifest, config: Dict[str, Any]):
        self.manifest = manifest
        self.config = config

    @abstractmethod
    async def initialize(self) -> None:
        """Validate credentials, test network reachability, and establish clients."""
        pass

    @abstractmethod
    async def execute(self) -> PluginExecutionResult:
        """Execute the integration task asynchronously and return structured results."""
        pass

    @abstractmethod
    async def teardown(self) -> None:
        """Clean up active connections and release resources."""
        pass
```

---

## 3. Sandboxing & Safe Execution Rules

1. **No Direct Database Access**: Plugins cannot execute raw SQL or access the database connection pool directly. All data ingestion occurs through strongly-typed repository contracts.
2. **Strict Timeouts**: Every plugin execution is bound to an asynchronous timeout (default: 30 seconds) to prevent hanging tasks.
3. **Egress Validation**: Network HTTP calls made by plugins must route through the `EgressProxy` to enforce anti-SSRF policies.
