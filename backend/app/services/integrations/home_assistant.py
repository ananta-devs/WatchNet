import json
import logging
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger("watchnet.integrations.home_assistant")


class HomeAssistantIntegration:
    """
    Home Assistant Integration Suite.
    - MQTT Auto-Discovery: Publishes standard discovery configurations for device_tracker and sensors.
    - REST Webhook integration: Dispatches device state changes to Home Assistant webhooks.
    """

    def __init__(self, ha_url: Optional[str] = None, webhook_id: Optional[str] = None):
        self.ha_url = ha_url.rstrip("/") if ha_url else None
        self.webhook_id = webhook_id

    @staticmethod
    def build_mqtt_device_tracker_config(device: Dict[str, Any], discovery_prefix: str = "homeassistant") -> Dict[str, Any]:
        """
        Builds MQTT Discovery payload for device_tracker.
        Topic: <discovery_prefix>/device_tracker/<clean_mac>/config
        """
        mac = device.get("mac", "").lower()
        clean_mac = mac.replace(":", "").replace("-", "")
        name = device.get("name") or f"Device {mac}"
        node_id = f"watchnet_{clean_mac}"

        topic = f"{discovery_prefix}/device_tracker/{node_id}/config"
        state_topic = f"watchnet/device/{clean_mac}/state"

        payload = {
            "name": name,
            "unique_id": f"watchnet_tracker_{clean_mac}",
            "state_topic": state_topic,
            "payload_home": "home",
            "payload_not_home": "not_home",
            "source_type": "router",
            "device": {
                "identifiers": [f"watchnet_{clean_mac}"],
                "name": name,
                "model": device.get("category", "Network Device"),
                "manufacturer": device.get("vendor", "WatchNet"),
                "connections": [["mac", mac]]
            }
        }
        if device.get("ipv4"):
            payload["json_attributes_topic"] = f"watchnet/device/{clean_mac}/attributes"

        return {
            "topic": topic,
            "payload": payload,
            "state_topic": state_topic,
            "state_value": "home" if device.get("status") == "online" else "not_home"
        }

    @staticmethod
    def build_mqtt_sensor_config(device: Dict[str, Any], sensor_type: str = "ip", discovery_prefix: str = "homeassistant") -> Dict[str, Any]:
        """
        Builds MQTT Discovery payload for accompanying sensors (e.g., IP address, latency).
        """
        mac = device.get("mac", "").lower()
        clean_mac = mac.replace(":", "").replace("-", "")
        name = device.get("name") or f"Device {mac}"
        node_id = f"watchnet_{clean_mac}_{sensor_type}"

        topic = f"{discovery_prefix}/sensor/{node_id}/config"
        state_topic = f"watchnet/device/{clean_mac}/{sensor_type}"

        payload = {
            "name": f"{name} {sensor_type.upper()}",
            "unique_id": f"watchnet_sensor_{clean_mac}_{sensor_type}",
            "state_topic": state_topic,
            "device": {
                "identifiers": [f"watchnet_{clean_mac}"],
                "name": name,
                "manufacturer": device.get("vendor", "WatchNet"),
                "connections": [["mac", mac]]
            }
        }
        if sensor_type == "ip":
            payload["icon"] = "mdi:ip-network"

        return {
            "topic": topic,
            "payload": payload,
            "state_topic": state_topic,
            "state_value": device.get("ipv4", "0.0.0.0")
        }

    async def publish_mqtt_discovery(self, device: Dict[str, Any], mqtt_config: Dict[str, Any]) -> bool:
        """
        Publishes MQTT Auto-Discovery configuration payload to configured MQTT broker.
        """
        try:
            import paho.mqtt.client as paho_mqtt
            host = mqtt_config.get("host", "localhost")
            port = int(mqtt_config.get("port", 1883))
            username = mqtt_config.get("username")
            password = mqtt_config.get("password")
            prefix = mqtt_config.get("discovery_prefix", "homeassistant")

            tracker_spec = self.build_mqtt_device_tracker_config(device, discovery_prefix=prefix)
            sensor_spec = self.build_mqtt_sensor_config(device, sensor_type="ip", discovery_prefix=prefix)

            client = paho_mqtt.Client()
            if username and password:
                client.username_pw_set(username, password)

            client.connect(host, port, 60)
            client.loop_start()

            # Publish discovery config
            client.publish(tracker_spec["topic"], json.dumps(tracker_spec["payload"]), retain=True)
            client.publish(tracker_spec["state_topic"], tracker_spec["state_value"], retain=True)

            # Publish IP sensor config
            client.publish(sensor_spec["topic"], json.dumps(sensor_spec["payload"]), retain=True)
            client.publish(sensor_spec["state_topic"], str(sensor_spec["state_value"]), retain=True)

            client.loop_stop()
            client.disconnect()
            return True
        except Exception as e:
            logger.error(f"[HomeAssistant] MQTT publish failed: {e}")
            return False

    async def dispatch_webhook(self, event_data: Dict[str, Any]) -> bool:
        """
        Sends device state update to Home Assistant via webhook endpoint:
        POST <ha_url>/api/webhook/<webhook_id>
        """
        if not self.ha_url or not self.webhook_id:
            logger.debug("[HomeAssistant] HA URL or Webhook ID not configured, skipping webhook dispatch.")
            return False

        endpoint = f"{self.ha_url}/api/webhook/{self.webhook_id}"
        payload = {
            "source": "WatchNet",
            "type": event_data.get("event_type", "device_update"),
            "device": {
                "mac": event_data.get("mac"),
                "ip": event_data.get("ipv4") or event_data.get("ip"),
                "name": event_data.get("name"),
                "status": event_data.get("status"),
                "category": event_data.get("category"),
                "vendor": event_data.get("vendor"),
            },
            "timestamp": event_data.get("timestamp")
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(endpoint, json=payload)
                return res.status_code in (200, 201)
        except Exception as e:
            logger.error(f"[HomeAssistant] Webhook post failed: {e}")
            return False

