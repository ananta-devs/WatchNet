import logging
from typing import Dict, List, Optional, Type
from app.services.plugins.base_plugin import BasePlugin

logger = logging.getLogger(__name__)


class PluginRegistry:
    """
    Dynamic plugin registrar discovering, loading, and managing all available plugins.
    """
    _instance: Optional["PluginRegistry"] = None

    def __init__(self):
        self._plugins: Dict[str, BasePlugin] = {}

    @classmethod
    def get_instance(cls) -> "PluginRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register(self, plugin_cls: Type[BasePlugin]) -> None:
        """
        Instantiate and register a plugin class.
        """
        plugin = plugin_cls()
        if not plugin.plugin_id:
            raise ValueError(f"Plugin {plugin_cls} must define a valid plugin_id")
        self._plugins[plugin.plugin_id] = plugin
        logger.debug("Registered plugin: %s (%s)", plugin.name, plugin.plugin_id)

    def unregister(self, plugin_id: str) -> None:
        if plugin_id in self._plugins:
            del self._plugins[plugin_id]

    def get_plugin(self, plugin_id: str) -> Optional[BasePlugin]:
        return self._plugins.get(plugin_id)

    def list_plugins(self, category: Optional[str] = None) -> List[BasePlugin]:
        plugins = list(self._plugins.values())
        if category:
            plugins = [p for p in plugins if p.category == category]
        return plugins

    def get_all_plugin_ids(self) -> List[str]:
        return list(self._plugins.keys())


def register_all_upstream_plugins(registry: PluginRegistry) -> None:
    """
    Imports and registers all available upstream plugin adapters into the registry.
    """
    from app.services.plugins.adapters.discovery import (
        OpenWrtAdapter,
        UniFiAdapter,
        AsusWrtAdapter,
        FritzBoxAdapter,
        MikroTikAdapter,
        OmadaAdapter,
        PiHoleAdapter,
        AdGuardAdapter,
        ArpScanAdapter,
        IpNeighAdapter,
        DhcpLeasesAdapter,
        SnmpAdapter,
        DockerAdapter,
        GenericRestAdapter,
        WiFiCanaryAdapter,
    )
    from app.services.plugins.adapters.name_resolution import (
        AvahiAdapter,
        DnsReverseAdapter,
        NetBiosAdapter,
    )
    from app.services.plugins.adapters.monitoring import (
        IcmpAdapter,
        InternetAdapter,
        SpeedtestAdapter,
        NmapAdapter,
        WebMonAdapter,
    )
    from app.services.plugins.adapters.notifications import (
        ApprisePublisher,
        SmtpPublisher,
        TelegramPublisher,
        MqttPublisher,
        NtfyPublisher,
        PushoverPublisher,
        PushsaferPublisher,
        WebhookPublisher,
    )
    from app.services.plugins.adapters.system import (
        BackupUtility,
        DbCleanupUtility,
        DdnsUtility,
        WakeOnLanUtility,
        VendorUpdateUtility,
    )

    adapters = [
        # Discovery / Import
        OpenWrtAdapter,
        UniFiAdapter,
        AsusWrtAdapter,
        FritzBoxAdapter,
        MikroTikAdapter,
        OmadaAdapter,
        PiHoleAdapter,
        AdGuardAdapter,
        ArpScanAdapter,
        IpNeighAdapter,
        DhcpLeasesAdapter,
        SnmpAdapter,
        DockerAdapter,
        GenericRestAdapter,
        WiFiCanaryAdapter,
        # Name Resolution
        AvahiAdapter,
        DnsReverseAdapter,
        NetBiosAdapter,
        # Monitoring
        IcmpAdapter,
        InternetAdapter,
        SpeedtestAdapter,
        NmapAdapter,
        WebMonAdapter,
        # Notifications
        ApprisePublisher,
        SmtpPublisher,
        TelegramPublisher,
        MqttPublisher,
        NtfyPublisher,
        PushoverPublisher,
        PushsaferPublisher,
        WebhookPublisher,
        # System
        BackupUtility,
        DbCleanupUtility,
        DdnsUtility,
        WakeOnLanUtility,
        VendorUpdateUtility,
    ]

    for adapter_cls in adapters:
        registry.register(adapter_cls)
