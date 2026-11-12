import asyncio
import socket
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("watchnet.monitoring.port_scanner")

# Common services mapped to default ports
COMMON_PORTS: Dict[int, str] = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    80: "HTTP",
    110: "POP3",
    139: "NetBIOS",
    143: "IMAP",
    443: "HTTPS",
    445: "SMB",
    554: "RTSP",
    1883: "MQTT",
    3389: "RDP",
    5000: "UPnP / Docker Registry",
    8000: "HTTP-Alt",
    8080: "HTTP-Proxy",
    8443: "HTTPS-Alt",
    8883: "MQTT-SSL",
    9000: "Portainer / SonarQube"
}

class PortScanner:
    def __init__(self, timeout: float = 1.0, max_concurrency: int = 50):
        self.timeout = timeout
        self.semaphore = asyncio.Semaphore(max_concurrency)

    async def probe_port(self, ip: str, port: int) -> Optional[Dict[str, Any]]:
        """
        Probe a single TCP port and grab service banner if accessible.
        """
        async with self.semaphore:
            service_name = COMMON_PORTS.get(port, f"Port-{port}")
            try:
                conn = asyncio.open_connection(ip, port)
                reader, writer = await asyncio.wait_for(conn, timeout=self.timeout)
                banner: Optional[str] = None
                
                # Attempt non-blocking banner grab
                try:
                    # For HTTP/HTTPS send minimal request to prompt banner
                    if port in (80, 8080, 8000):
                        writer.write(b"HEAD / HTTP/1.0\r\n\r\n")
                        await writer.drain()
                    elif port in (21, 22):
                        pass # SSH and FTP servers send banner upon connect
                    
                    banner_bytes = await asyncio.wait_for(reader.read(512), timeout=0.8)
                    if banner_bytes:
                        banner = banner_bytes.decode("utf-8", errors="replace").strip()
                except Exception:
                    pass
                finally:
                    writer.close()
                    try:
                        await writer.wait_closed()
                    except Exception:
                        pass

                return {
                    "port": port,
                    "protocol": "tcp",
                    "service_name": service_name,
                    "state": "open",
                    "banner": banner
                }
            except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
                return None

    async def scan_target(self, ip: str, ports: Optional[List[int]] = None) -> List[Dict[str, Any]]:
        """
        Scan target IP for given or default common ports concurrently.
        """
        target_ports = ports or list(COMMON_PORTS.keys())
        tasks = [self.probe_port(ip, p) for p in target_ports]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        open_ports = []
        for res in results:
            if isinstance(res, dict) and res.get("state") == "open":
                open_ports.append(res)

        return sorted(open_ports, key=lambda x: x["port"])
