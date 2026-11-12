import asyncio
import time
import socket
import logging
import subprocess
import sys
import re
from typing import Dict, Any, List, Optional
import httpx
import dns.asyncresolver
from datetime import datetime, timezone

logger = logging.getLogger("watchnet.monitoring.internet")

DNS_SERVERS = {
    "Cloudflare": "1.1.1.1",
    "Google": "8.8.8.8",
    "Quad9": "9.9.9.9"
}

IP_ECHO_SERVICES = [
    "https://api.ipify.org?format=json",
    "https://ifconfig.me/all.json",
    "https://icanhazip.com"
]

def detect_system_gateway() -> Optional[str]:
    """
    Detect the active default gateway IP using OS route tables.
    """
    try:
        if sys.platform == "win32":
            out = subprocess.check_output(["route", "print", "0.0.0.0"], text=True, stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                parts = line.strip().split()
                if len(parts) >= 5 and parts[0] == "0.0.0.0" and parts[1] == "0.0.0.0":
                    return parts[2]
        else:
            out = subprocess.check_output(["ip", "route"], text=True, stderr=subprocess.DEVNULL)
            for line in out.splitlines():
                if line.startswith("default via"):
                    return line.split()[2]
    except Exception as e:
        logger.debug(f"Failed detecting system default gateway: {e}")
    return None

class InternetMonitor:
    def __init__(self, timeout: float = 3.0):
        self.timeout = timeout

    async def get_wan_ip(self) -> Optional[str]:
        """Detect public WAN IP using multiple redundant external echo endpoints."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for endpoint in IP_ECHO_SERVICES:
                try:
                    res = await client.get(endpoint)
                    if res.status_code == 200:
                        text = res.text.strip()
                        if "{" in text:
                            data = res.json()
                            ip = data.get("ip") or data.get("ip_addr")
                            if ip:
                                return str(ip).strip()
                        else:
                            return text
                except Exception as e:
                    logger.debug(f"Failed querying WAN IP endpoint {endpoint}: {e}")
                    continue
        return None

    async def ping_gateway(self, gateway_ip: Optional[str] = None) -> Optional[float]:
        """
        Measure gateway / upstream reachability latency in milliseconds.
        Discovers active default gateway automatically if not provided.
        Uses non-blocking ICMP ping or socket probing.
        """
        target = gateway_ip or detect_system_gateway() or "1.1.1.1"
        loop = asyncio.get_running_loop()

        def _do_icmp_ping():
            try:
                cmd = ["ping", "-n", "1", "-w", str(int(self.timeout * 1000)), target] if sys.platform == "win32" else ["ping", "-c", "1", "-W", str(int(self.timeout)), target]
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                if res.returncode == 0:
                    m = re.search(r'(?:time[=<]|Average = )([0-9.]+)\s*ms', res.stdout, re.IGNORECASE)
                    if m:
                        return float(m.group(1))
                    return 1.0
            except Exception:
                pass
            return None

        # Try ICMP ping first
        icmp_latency = await loop.run_in_executor(None, _do_icmp_ping)
        if icmp_latency is not None:
            return round(icmp_latency, 2)

        # Fallback to async TCP socket probe (port 53 DNS or 80 HTTP)
        for test_port in (53, 80):
            start = time.perf_counter()
            try:
                conn = asyncio.open_connection(target, test_port)
                reader, writer = await asyncio.wait_for(conn, timeout=self.timeout)
                writer.close()
                await writer.wait_closed()
                latency = (time.perf_counter() - start) * 1000.0
                return round(latency, 2)
            except Exception:
                continue

        return None

    async def test_dns_resolution(self, domain: str = "cloudflare.com") -> Dict[str, Optional[float]]:
        """
        Track DNS resolution latency individually across multiple upstream resolvers
        (Cloudflare 1.1.1.1, Google 8.8.8.8, Quad9 9.9.9.9).
        """
        results: Dict[str, Optional[float]] = {}

        for name, server in DNS_SERVERS.items():
            start = time.perf_counter()
            try:
                resolver = dns.asyncresolver.Resolver()
                resolver.nameservers = [server]
                resolver.timeout = self.timeout
                resolver.lifetime = self.timeout
                await resolver.resolve(domain, "A")
                latency = (time.perf_counter() - start) * 1000.0
                results[name] = round(latency, 2)
            except Exception as e:
                logger.debug(f"Direct DNS resolution failed for {name} ({server}): {e}")
                # Fallback check via system resolver if specific nameserver blocked
                try:
                    loop = asyncio.get_running_loop()
                    start_fb = time.perf_counter()
                    await asyncio.wait_for(
                        loop.run_in_executor(None, socket.gethostbyname, domain),
                        timeout=self.timeout
                    )
                    fb_latency = (time.perf_counter() - start_fb) * 1000.0
                    results[name] = round(fb_latency, 2)
                except Exception:
                    results[name] = None

        return results

    async def run_full_check(self, gateway_ip: Optional[str] = None) -> Dict[str, Any]:
        """Runs complete Internet health diagnostics."""
        target_gw = gateway_ip or detect_system_gateway()
        wan_ip_task = self.get_wan_ip()
        gateway_task = self.ping_gateway(target_gw)
        dns_task = self.test_dns_resolution()

        wan_ip, gateway_latency, dns_results = await asyncio.gather(
            wan_ip_task, gateway_task, dns_task, return_exceptions=True
        )

        resolved_wan_ip = wan_ip if isinstance(wan_ip, str) else None
        resolved_gateway_latency = gateway_latency if isinstance(gateway_latency, (int, float)) else None
        resolved_dns = dns_results if isinstance(dns_results, dict) else {}

        # Compute average DNS resolution latency from successful checks
        valid_dns = [v for v in resolved_dns.values() if isinstance(v, (int, float))]
        avg_dns = round(sum(valid_dns) / len(valid_dns), 2) if valid_dns else None

        is_connected = (resolved_wan_ip is not None or resolved_gateway_latency is not None)

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "wan_ip": resolved_wan_ip,
            "gateway_latency_ms": resolved_gateway_latency,
            "dns_resolution_ms": avg_dns,
            "dns_resolvers": resolved_dns,
            "is_connected": is_connected
        }

