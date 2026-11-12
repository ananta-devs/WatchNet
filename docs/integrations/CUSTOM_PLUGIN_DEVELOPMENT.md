# WatchNet Custom Plugin Development

**Document Version:** 1.0.0  
**SDK:** Python 3.12 / WatchNet Plugin API  

---

## 1. Creating a New Plugin

To create a custom integration plugin for WatchNet:
1. Create a directory under `server/plugins/my_custom_plugin/`.
2. Define `manifest.json` containing metadata, category, and configuration schema.
3. Implement `plugin.py` subclassing `BasePlugin` from `watchnet.plugins.base`.

```python
from watchnet.plugins.base import BasePlugin, PluginManifest, PluginExecutionResult

class MyCustomPlugin(BasePlugin):
    async def initialize(self) -> None:
        self.target_url = self.config.get("target_url")

    async def execute(self) -> PluginExecutionResult:
        # Perform asynchronous discovery via EgressProxy
        async with self.http_client() as client:
            resp = await client.get(self.target_url)
            data = resp.json()
        return PluginExecutionResult(success=True, items_discovered=len(data), data=data)

    async def teardown(self) -> None:
        pass
```
