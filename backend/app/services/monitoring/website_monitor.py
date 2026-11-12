import asyncio
import ssl
import socket
import logging
import time
from urllib.parse import urlparse
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import httpx
from cryptography import x509

logger = logging.getLogger("watchnet.monitoring.website")

class WebsiteMonitor:
    def __init__(self, timeout: float = 10.0):
        self.timeout = timeout

    async def check_ssl_expiry(self, hostname: str, port: int = 443) -> Optional[int]:
        """
        Inspect TLS/SSL certificate and compute days remaining until expiration.
        Supports standard CAs, intermediate chains, as well as self-signed / internal certificates.
        """
        loop = asyncio.get_running_loop()

        def _get_cert_expiry():
            context = ssl.create_default_context()
            # Disable verification for inspection so self-signed certs still return days remaining
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            with socket.create_connection((hostname, port), timeout=self.timeout) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    der = ssock.getpeercert(binary_form=True)
                    if not der:
                        return None
                    cert = x509.load_der_x509_certificate(der)
                    not_after = cert.not_valid_after_utc
                    now = datetime.now(timezone.utc)
                    delta = not_after - now
                    return max(0, delta.days)

        try:
            days = await loop.run_in_executor(None, _get_cert_expiry)
            return days
        except Exception as e:
            logger.debug(f"SSL expiry check error for {hostname}: {e}")
            return None

    async def check_endpoint(self, url: str) -> Dict[str, Any]:
        """
        Probe HTTP/HTTPS endpoint uptime, response latency, and SSL status.
        """
        parsed = urlparse(url)
        hostname = parsed.hostname or url
        scheme = parsed.scheme.lower() if parsed.scheme else "http"
        port = parsed.port or (443 if scheme == "https" else 80)

        start = time.perf_counter()
        status_code: Optional[int] = None
        latency_ms: Optional[float] = None
        is_up = False
        error_message: Optional[str] = None
        ssl_days: Optional[int] = None

        # Execute HTTP probe
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True, verify=False) as client:
                res = await client.get(url)
                latency_ms = round((time.perf_counter() - start) * 1000.0, 2)
                status_code = res.status_code
                is_up = (200 <= status_code < 400)
        except Exception as e:
            latency_ms = round((time.perf_counter() - start) * 1000.0, 2)
            error_message = str(e)
            is_up = False

        # If HTTPS, probe SSL expiration
        if scheme == "https":
            ssl_days = await self.check_ssl_expiry(hostname, port)

        return {
            "url": url,
            "status_code": status_code,
            "latency_ms": latency_ms,
            "is_up": is_up,
            "ssl_days_remaining": ssl_days,
            "error_message": error_message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

