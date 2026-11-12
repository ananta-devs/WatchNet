import asyncio
import time
import logging
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger("watchnet.monitoring.speedtest")

# Fast, high-bandwidth CDN endpoints suitable for download throughput testing
SPEEDTEST_PAYLOAD_URLS = [
    "https://speed.cloudflare.com/__down?bytes=10000000",  # 10MB
    "https://proof.ovh.net/files/10Mb.dat",
    "https://tele2-se.speedtest.clouvider.net/10MB.bin"
]

SPEEDTEST_UPLOAD_URLS = [
    "https://speed.cloudflare.com/__up",
    "https://speed.hetzner.de",
    "https://httpbin.org/post"
]

SPEEDTEST_PING_HOSTS = [
    "1.1.1.1",
    "8.8.8.8"
]

class SpeedtestService:
    def __init__(self, timeout: float = 15.0):
        self.timeout = timeout

    async def measure_ping_and_jitter(self, target_host: str = "1.1.1.1", samples: int = 5) -> Dict[str, float]:
        """
        Measure ping latency, jitter, and packet loss in milliseconds using repeated TCP handshake probes.
        """
        latencies = []
        lost_count = 0

        for _ in range(samples):
            start = time.perf_counter()
            try:
                conn = asyncio.open_connection(target_host, 53)
                reader, writer = await asyncio.wait_for(conn, timeout=2.0)
                writer.close()
                await writer.wait_closed()
                latencies.append((time.perf_counter() - start) * 1000.0)
            except Exception:
                lost_count += 1
            await asyncio.sleep(0.04)

        packet_loss = round((lost_count / samples) * 100.0, 1)

        if not latencies:
            return {
                "ping_ms": 0.0,
                "jitter_ms": 0.0,
                "packet_loss_pct": packet_loss
            }

        avg_ping = sum(latencies) / len(latencies)
        # Jitter calculation: RFC 3550 / mean absolute deviation between consecutive packets
        if len(latencies) > 1:
            diffs = [abs(latencies[i] - latencies[i-1]) for i in range(1, len(latencies))]
            jitter = sum(diffs) / len(diffs)
        else:
            jitter = 0.0

        return {
            "ping_ms": round(avg_ping, 2),
            "jitter_ms": round(jitter, 2),
            "packet_loss_pct": packet_loss
        }

    async def measure_download_speed(self) -> float:
        """
        Download a test chunk from CDN and calculate throughput in Mbps.
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for url in SPEEDTEST_PAYLOAD_URLS:
                try:
                    start = time.perf_counter()
                    total_bytes = 0
                    async with client.stream("GET", url) as response:
                        if response.status_code != 200:
                            continue
                        async for chunk in response.aiter_bytes(chunk_size=65536):
                            total_bytes += len(chunk)
                            # Stop after 5 seconds or 15MB to bound runtime
                            if time.perf_counter() - start > 5.0 or total_bytes >= 15 * 1024 * 1024:
                                break
                    duration = time.perf_counter() - start
                    if duration > 0 and total_bytes > 0:
                        mbps = (total_bytes * 8) / (duration * 1_000_000)
                        return round(mbps, 2)
                except Exception as e:
                    logger.debug(f"Speedtest download probe failed on {url}: {e}")
                    continue
        return 0.0

    async def measure_upload_speed(self) -> float:
        """
        Execute actual upload speed probe via HTTP POST of a 1 MB payload to CDN edge.
        """
        dummy_chunk = b"0" * (1024 * 1024)  # 1 MB
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for target_url in SPEEDTEST_UPLOAD_URLS:
                try:
                    start = time.perf_counter()
                    res = await client.post(target_url, content=dummy_chunk)
                    duration = time.perf_counter() - start
                    if res.status_code in (200, 201, 204) and duration > 0:
                        mbps = (len(dummy_chunk) * 8) / (duration * 1_000_000)
                        return round(mbps, 2)
                except Exception as e:
                    logger.debug(f"Speedtest upload probe failed on {target_url}: {e}")
                    continue

        return 0.0

    async def run_speedtest(self) -> Dict[str, Any]:
        """
        Executes complete speedtest cycle: ping, jitter, packet loss, download, and upload.
        """
        ping_stats = await self.measure_ping_and_jitter("1.1.1.1", samples=5)
        download_mbps = await self.measure_download_speed()
        upload_mbps = await self.measure_upload_speed()

        # If offline or isolated network, gracefully handle zeroes
        return {
            "download_mbps": download_mbps,
            "upload_mbps": upload_mbps,
            "ping_ms": ping_stats["ping_ms"],
            "jitter_ms": ping_stats["jitter_ms"],
            "packet_loss_pct": ping_stats.get("packet_loss_pct", 0.0),
            "server_name": "Cloudflare Edge CDN",
            "server_location": "Global Anycast",
            "client_ip": "Auto-detected"
        }

