import asyncio
import xml.etree.ElementTree as ET
import shutil
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("watchnet.discovery.nmap")

class NmapScanner:
    """
    Asynchronous Nmap scanner adapter.
    Executes service detection and OS fingerprinting on detected active hosts,
    parsing the resulting XML into structured data.
    """
    def __init__(self, nmap_bin: Optional[str] = None):
        self.nmap_bin = nmap_bin or shutil.which("nmap")

    def is_available(self) -> bool:
        return self.nmap_bin is not None

    async def scan_hosts(self, targets: List[str], ports: str = "22,80,443,445,8080", timeout: int = 60) -> List[Dict[str, Any]]:
        """
        Runs nmap service scan against list of IP addresses or subnets.
        Command equivalent: nmap -sV -O --osscan-limit -p <ports> -oX - <targets>
        """
        if not targets:
            return []

        if not self.is_available():
            logger.warning("nmap executable not found on host system. Returning synthetic/empty scan.")
            return []

        cmd = [
            self.nmap_bin,
            "-sV",
            "-O",
            "--osscan-limit",
            "-p", ports,
            "-oX", "-", # output XML to stdout
            *targets
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return self.parse_nmap_xml(stdout.decode("utf-8", errors="replace"))
        except asyncio.TimeoutError:
            logger.error(f"Nmap scan timed out after {timeout} seconds")
            return []
        except Exception as e:
            logger.error(f"Error executing nmap: {e}")
            return []

    def parse_nmap_xml(self, xml_content: str) -> List[Dict[str, Any]]:
        """
        Parses Nmap XML output into clean structured device records.
        """
        results = []
        if not xml_content.strip():
            return results

        try:
            root = ET.fromstring(xml_content)
        except ET.ParseError as e:
            logger.error(f"Failed to parse nmap XML: {e}")
            return results

        for host in root.findall("host"):
            # Check host status
            status_elem = host.find("status")
            if status_elem is not None and status_elem.get("state") != "up":
                continue

            ip = None
            mac = None
            vendor = None

            for addr in host.findall("address"):
                addr_type = addr.get("addrtype")
                if addr_type == "ipv4":
                    ip = addr.get("addr")
                elif addr_type == "ipv6" and not ip:
                    ip = addr.get("addr")
                elif addr_type == "mac":
                    mac = addr.get("addr", "").lower()
                    vendor = addr.get("vendor")

            hostnames = []
            for hostname in host.findall(".//hostname"):
                h_name = hostname.get("name")
                if h_name:
                    hostnames.append(h_name)

            # Ports and Services
            services = []
            for port in host.findall(".//port"):
                port_id = port.get("portid")
                proto = port.get("protocol")
                state_elem = port.find("state")
                state = state_elem.get("state") if state_elem is not None else "unknown"

                service_elem = port.find("service")
                service_info = {}
                if service_elem is not None:
                    service_info = {
                        "name": service_elem.get("name", "unknown"),
                        "product": service_elem.get("product", ""),
                        "version": service_elem.get("version", ""),
                        "extrainfo": service_elem.get("extrainfo", "")
                    }

                services.append({
                    "port": int(port_id) if port_id and port_id.isdigit() else port_id,
                    "protocol": proto,
                    "state": state,
                    "service": service_info
                })

            # OS detection matches
            os_matches = []
            for osmatch in host.findall(".//osmatch"):
                os_matches.append({
                    "name": osmatch.get("name"),
                    "accuracy": int(osmatch.get("accuracy", "0"))
                })

            results.append({
                "ip": ip,
                "mac": mac,
                "vendor": vendor,
                "hostnames": hostnames,
                "services": services,
                "os_matches": os_matches
            })

        return results
