from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExecutionContext(BaseModel):
    plugin_id: str
    run_id: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    triggered_by: str = "scheduler"  # scheduler, manual, event


class PluginResult(BaseModel):
    success: bool
    status: str = "success"  # success, failed, skipped, timeout
    items_produced: int = 0
    data: Any = None
    log_output: str = ""
    error: Optional[str] = None


class BasePlugin(ABC):
    """
    Abstract Base Class for all WatchNet plugins.
    """
    name: str
    plugin_id: str
    category: str  # discovery, name_resolution, monitoring, notification, system
    description: str = ""
    config_schema: Optional[type[BaseModel]] = None

    def __init__(self):
        self._config: Dict[str, Any] = {}
        self._initialized: bool = False

    def initialize(self, config: Dict[str, Any]) -> None:
        """
        Initializes plugin with validated configuration.
        """
        self.validate_config(config)
        self._config = config
        self._initialized = True

    def validate_config(self, config: Dict[str, Any]) -> bool:
        """
        Validates configuration against config_schema.
        Raises ValidationError if invalid.
        """
        if self.config_schema is not None and self.config_schema is not BaseModel:
            self.config_schema.model_validate(config)
        return True

    @abstractmethod
    async def execute(self, context: ExecutionContext) -> PluginResult:
        """
        Core execution logic for the plugin.
        """
        pass

    async def teardown(self) -> None:
        """
        Teardown / cleanup hook when plugin stops or shuts down.
        """
        self._initialized = False
