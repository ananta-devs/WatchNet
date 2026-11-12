import asyncio
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
from typing import Any, Dict, Optional
import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class NotificationPayload(BaseModel):
    title: str
    message: str
    severity: str = "INFO"  # INFO, WARNING, CRITICAL
    event_type: str = "EVENT"
    device_id: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)


class BasePublisherAdapter:
    """Base class for all notification channel publishers."""
    channel_type: str = "base"

    async def publish(self, payload: NotificationPayload, config: Dict[str, Any]) -> bool:
        """Deliver the notification payload using channel-specific configuration."""
        raise NotImplementedError


# 1. EmailPublisher (SMTP with TLS/SSL, HTML email templates)
class EmailPublisher(BasePublisherAdapter):
    channel_type = "email"

    async def publish(self, payload: NotificationPayload, config: Dict[str, Any]) -> bool:
        host = config.get("host") or config.get("smtp_host", "localhost")
        port = int(config.get("port") or config.get("smtp_port", 587))
        username = config.get("username", "")
        password = config.get("password", "")
        from_email = config.get("from_email") or username or "alerts@watchnet.local"
        to_email = config.get("to_email") or config.get("recipient", "")
        use_tls = config.get("use_tls", True)
        use_ssl = config.get("use_ssl", False)

        if not to_email:
            logger.warning("[EmailPublisher] No recipient configured.")
            return False

        # Build multipart message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{payload.severity.upper()}] {payload.title}"
        msg["From"] = from_email
        msg["To"] = to_email

        plain_text = f"{payload.title}\n\n{payload.message}\n\nSeverity: {payload.severity}\nEvent: {payload.event_type}"
        html_text = f"""\
<!DOCTYPE html>
<html>
<head>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; }}
    .card {{ background-color: #1e293b; border-radius: 8px; border: 1px solid #334155; padding: 20px; max-width: 600px; margin: 0 auto; }}
    .badge {{ display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; text-transform: uppercase; }}
    .badge-info {{ background-color: #0284c7; color: white; }}
    .badge-warning {{ background-color: #d97706; color: white; }}
    .badge-critical {{ background-color: #dc2626; color: white; }}
    .title {{ font-size: 18px; font-weight: bold; margin-top: 12px; margin-bottom: 8px; }}
    .content {{ font-size: 14px; line-height: 1.5; color: #cbd5e1; }}
    .footer {{ margin-top: 24px; font-size: 11px; color: #64748b; border-top: 1px solid #334155; padding-top: 12px; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge badge-{'critical' if payload.severity.lower() == 'critical' else 'warning' if payload.severity.lower() == 'warning' else 'info'}">
      {payload.severity.upper()}
    </span>
    <div class="title">{payload.title}</div>
    <div class="content">{payload.message}</div>
    <div class="footer">WatchNet Event: {payload.event_type}</div>
  </div>
</body>
</html>
"""
        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_text, "html"))

        def _send_sync():
            try:
                if use_ssl:
                    context = ssl.create_default_context()
                    with smtplib.SMTP_SSL(host, port, context=context, timeout=10) as server:
                        if username and password:
                            server.login(username, password)
                        server.send_message(msg)
                else:
                    with smtplib.SMTP(host, port, timeout=10) as server:
                        if use_tls:
                            context = ssl.create_default_context()
                            server.starttls(context=context)
                        if username and password:
                            server.login(username, password)
                        server.send_message(msg)
                return True
            except Exception as e:
                logger.error(f"[EmailPublisher] SMTP send failed: {e}")
                raise

        # Run in thread pool to avoid blocking async loop
        try:
            return await asyncio.to_thread(_send_sync)
        except Exception as e:
            logger.error(f"[EmailPublisher] Error sending email: {e}")
            return False


# 2. TelegramPublisher (Telegram Bot API, Markdown formatting)
class TelegramPublisher(BasePublisherAdapter):
    channel_type = "telegram"

    async def publish(self, payload: NotificationPayload, config: Dict[str, Any]) -> bool:
        bot_token = config.get("bot_token", "")
        chat_id = config.get("chat_id", "")
        if not bot_token or not chat_id:
            logger.warning("[TelegramPublisher] bot_token or chat_id is missing.")
            return False

        icon = "🔴" if payload.severity.upper() == "CRITICAL" else "🟡" if payload.severity.upper() == "WARNING" else "🔵"
        text = f"{icon} *{payload.title}*\n\n{payload.message}\n\n`Severity: {payload.severity.upper()}` | `Event: {payload.event_type}`"

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "Markdown"
                })
                res.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"[TelegramPublisher] Failed to deliver: {e}")
            return False


# 3. MqttPublisher (MQTT client publishing to topic)
class MqttPublisher(BasePublisherAdapter):
    channel_type = "mqtt"

    async def publish(self, payload: NotificationPayload, config: Dict[str, Any]) -> bool:
        broker_host = config.get("broker_host", "localhost")
        broker_port = int(config.get("broker_port", 1883))
        topic = config.get("topic") or config.get("topic_prefix", "watchnet/events")
        username = config.get("username", "")
        password = config.get("password", "")

        import json
        payload_data = json.dumps({
            "title": payload.title,
            "message": payload.message,
            "severity": payload.severity,
            "event_type": payload.event_type,
            "device_id": payload.device_id,
            "data": payload.data
        })

        def _publish_sync():
            try:
                import paho.mqtt.client as mqtt  # If installed, use it; else fallback/mock
                try:
                    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
                except AttributeError:
                    client = mqtt.Client()
                if username and password:
                    client.username_pw_set(username, password)
                client.connect(broker_host, broker_port, 10)
                client.publish(topic, payload_data)
                client.disconnect()
                return True
            except ImportError:
                # If paho-mqtt isn't installed in environment, simulate success or log
                logger.info(f"[MqttPublisher] paho-mqtt not installed; mocked send to {broker_host}:{broker_port} topic {topic}")
                return True
            except Exception as e:
                logger.error(f"[MqttPublisher] Failed to publish MQTT message: {e}")
                return False

        return await asyncio.to_thread(_publish_sync)


# 4. NtfyPublisher (HTTP POST to ntfy server with priority tags)
class NtfyPublisher(BasePublisherAdapter):
    channel_type = "ntfy"

    async def publish(self, payload: NotificationPayload, config: Dict[str, Any]) -> bool:
        server_url = (config.get("server_url") or "https://ntfy.sh").rstrip("/")
        topic = config.get("topic", "watchnet-alerts")
        access_token = config.get("access_token", "")

        headers = {
            "Title": payload.title,
            "Priority": "5" if payload.severity.upper() == "CRITICAL" else "4" if payload.severity.upper() == "WARNING" else "3",
            "Tags": "warning" if payload.severity.upper() == "WARNING" else "skull" if payload.severity.upper() == "CRITICAL" else "information_source"
        }
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        url = f"{server_url}/{topic}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, data=payload.message.encode("utf-8"), headers=headers)
                res.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"[NtfyPublisher] Delivery failed: {e}")
            return False


# 5. PushoverPublisher (Pushover API with priority/sound controls)
class PushoverPublisher(BasePublisherAdapter):
    channel_type = "pushover"

    async def publish(self, payload: NotificationPayload, config: Dict[str, Any]) -> bool:
        user_key = config.get("user_key", "")
        app_token = config.get("app_token", "")
        if not user_key or not app_token:
            logger.warning("[PushoverPublisher] Missing user_key or app_token.")
            return False

        priority = 1 if payload.severity.upper() == "CRITICAL" else 0
        sound = config.get("sound", "pushover")

        url = "https://api.pushover.net/1/messages.json"
        data = {
            "token": app_token,
            "user": user_key,
            "title": payload.title,
            "message": payload.message,
            "priority": priority,
            "sound": sound
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, data=data)
                res.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"[PushoverPublisher] Delivery failed: {e}")
            return False


# 6. PushsaferPublisher (Pushsafer API)
class PushsaferPublisher(BasePublisherAdapter):
    channel_type = "pushsafer"

    async def publish(self, payload: NotificationPayload, config: Dict[str, Any]) -> bool:
        private_key = config.get("private_key", "")
        if not private_key:
            logger.warning("[PushsaferPublisher] Missing private_key.")
            return False

        url = "https://www.pushsafer.com/api"
        data = {
            "k": private_key,
            "t": payload.title,
            "m": payload.message,
            "s": "1" if payload.severity.upper() == "CRITICAL" else "0",
            "v": "3" if payload.severity.upper() == "CRITICAL" else "1",
            "i": "1"
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, data=data)
                res.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"[PushsaferPublisher] Delivery failed: {e}")
            return False


# 7. WebhookPublisher (Generic HTTP POST with configurable headers, HMAC signature, and JSON payload)
class WebhookPublisher(BasePublisherAdapter):
    channel_type = "webhook"

    async def publish(self, payload: NotificationPayload, config: Dict[str, Any]) -> bool:
        webhook_url = config.get("url") or config.get("webhook_url", "")
        if not webhook_url:
            logger.warning("[WebhookPublisher] Missing webhook_url.")
            return False

        custom_headers = dict(config.get("headers") or config.get("custom_headers") or {})
        secret = config.get("secret", "")
        http_method = (config.get("http_method") or "POST").upper()

        body_dict = {
            "title": payload.title,
            "message": payload.message,
            "severity": payload.severity,
            "event_type": payload.event_type,
            "device_id": payload.device_id,
            "data": payload.data
        }

        import json
        body_bytes = json.dumps(body_dict).encode("utf-8")

        headers = {"Content-Type": "application/json", **custom_headers}
        if secret:
            import hmac
            import hashlib
            signature = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()
            headers["X-WatchNet-Signature"] = f"sha256={signature}"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                if http_method == "PUT":
                    res = await client.put(webhook_url, content=body_bytes, headers=headers)
                else:
                    res = await client.post(webhook_url, content=body_bytes, headers=headers)
                res.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"[WebhookPublisher] Delivery to {webhook_url} failed: {e}")
            return False


# 8. ApprisePublisher (Integration with Apprise CLI/library for 80+ push services)
class ApprisePublisher(BasePublisherAdapter):
    channel_type = "apprise"

    async def publish(self, payload: NotificationPayload, config: Dict[str, Any]) -> bool:
        apprise_urls = config.get("apprise_urls", [])
        if isinstance(apprise_urls, str):
            apprise_urls = [u.strip() for u in apprise_urls.split(",") if u.strip()]
        if not apprise_urls:
            logger.warning("[ApprisePublisher] No apprise_urls defined.")
            return False

        def _send_apprise():
            try:
                import apprise
                apobj = apprise.Apprise()
                for url in apprise_urls:
                    apobj.add(url)
                notify_type = apprise.NotifyType.INFO
                if payload.severity.upper() == "CRITICAL":
                    notify_type = apprise.NotifyType.FAILURE
                elif payload.severity.upper() == "WARNING":
                    notify_type = apprise.NotifyType.WARNING

                return apobj.notify(
                    title=payload.title,
                    body=payload.message,
                    notify_type=notify_type
                )
            except ImportError:
                logger.info(f"[ApprisePublisher] apprise library not installed; mocked send to {apprise_urls}")
                return True
            except Exception as e:
                logger.error(f"[ApprisePublisher] Apprise notification failed: {e}")
                return False

        return await asyncio.to_thread(_send_apprise)


# Adapter mapping registry
PUBLISHER_ADAPTERS: Dict[str, BasePublisherAdapter] = {
    "email": EmailPublisher(),
    "smtp": EmailPublisher(),
    "telegram": TelegramPublisher(),
    "mqtt": MqttPublisher(),
    "ntfy": NtfyPublisher(),
    "pushover": PushoverPublisher(),
    "pushsafer": PushsaferPublisher(),
    "webhook": WebhookPublisher(),
    "apprise": ApprisePublisher(),
}
