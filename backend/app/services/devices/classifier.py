"""
Device Classification Engine.
Heuristic analysis of MAC OUI, hostname patterns, DHCP option signatures,
open ports, and Nmap OS clues to classify devices into standard categories:
- Mobile
- Desktop/Laptop
- IoT/Smart Home
- Network/Infrastructure
- Server
- Gaming/Media
- Unknown
"""
import re
from typing import Optional, Dict, Any, List
from app.models.entities import DeviceCategory
from app.services.devices.oui_resolver import oui_resolver, is_laa_randomized


class DeviceClassifier:
    """
    Rule-based and heuristic device classification engine.
    Analyzes multiple signals with priority ranking:
    1. Direct user / manual override (if present)
    2. Nmap OS detection clues
    3. Hostname regex patterns
    4. DHCP options / vendor class identifier
    5. Open port fingerprints
    6. Hardware MAC OUI vendor heuristics
    """

    # Hostname pattern rules
    _HOSTNAME_RULES = [
        # Mobile
        (re.compile(r"(iphone|ipad|ipod|galaxy-s|galaxy-a|pixel|oneplus|xperia|redmi|xiaomi|mobile|android)", re.I), DeviceCategory.MOBILE, "phone"),
        # Gaming / Media
        (re.compile(r"(playstation|ps4|ps5|xbox|nintendo|switch|appletv|roku|firetv|chromecast|shield|bravia|smarttv|tv-)", re.I), DeviceCategory.GAMING_MEDIA, "tv"),
        # IoT / Smart Home
        (re.compile(r"(esp_|esp32|esp8266|tasmota|shelly|sonoff|tuya|wemo|hue|nest|ring|alexa|echo|homepod|camera|cam-|bulb|plug|vacuum|roomba)", re.I), DeviceCategory.IOT_SMART_HOME, "cpu"),
        # Network / Infrastructure
        (re.compile(r"(router|gateway|switch|ap-|accesspoint|unifi|udm|mikrotik|cisco|pfsense|opnsense|openwrt|mesh|repeater)", re.I), DeviceCategory.NETWORK_INFRASTRUCTURE, "network"),
        # Server / NAS
        (re.compile(r"(server|proxmox|esxi|synology|qnap|truenas|unraid|docker|kube|pve|nas-|pihole|homeassistant|hass)", re.I), DeviceCategory.SERVER, "server"),
        # Desktop / Laptop
        (re.compile(r"(macbook|imac|mac-mini|thinkpad|latitude|desktop|laptop|surface|workstation|pc-|win10|win11)", re.I), DeviceCategory.DESKTOP_LAPTOP, "laptop"),
    ]

    # Vendor-based fallback rules
    _VENDOR_RULES = [
        # IoT / Smart Home
        (["espressif", "tuya", "sonoff", "shelly", "belkin", "ring", "nest", "wyze", "philips lighting", "ecobee"], DeviceCategory.IOT_SMART_HOME, "cpu"),
        # Network / Infrastructure
        (["cisco", "ubiquiti", "mikrotik", "netgear", "tp-link", "juniper", "aruba", "fortinet", "zyxel"], DeviceCategory.NETWORK_INFRASTRUCTURE, "network"),
        # Server
        (["synology", "qnap", "vmware", "proxmox", "supermicro"], DeviceCategory.SERVER, "server"),
        # Gaming / Media
        (["nintendo", "sonos", "roku"], DeviceCategory.GAMING_MEDIA, "tv"),
        # Raspberry Pi
        (["raspberry pi"], DeviceCategory.IOT_SMART_HOME, "cpu"),
    ]

    @classmethod
    def classify(
        cls,
        mac: str,
        hostname: Optional[str] = None,
        vendor: Optional[str] = None,
        os_clues: Optional[str] = None,
        dhcp_vendor: Optional[str] = None,
        open_ports: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Classifies device and suggests an icon based on telemetry clues.
        Returns: {
            "category": DeviceCategory,
            "icon": str (lucide icon name e.g. "smartphone", "laptop", "server"),
            "confidence": float (0.0 to 1.0),
            "reasons": list[str]
        }
        """
        reasons: List[str] = []
        category = DeviceCategory.UNKNOWN
        icon = "help-circle"
        confidence = 0.1

        # 1. Resolve vendor if not supplied
        if not vendor:
            vendor, is_rand = oui_resolver.lookup(mac)
            if is_rand:
                reasons.append("MAC is private/randomized (RFC 7042 LAA bit set)")

        # 2. Check Nmap OS detection clues (High confidence)
        if os_clues:
            os_lower = os_clues.lower()
            if any(k in os_lower for k in ["ios", "iphone", "android", "ipad"]):
                return {
                    "category": DeviceCategory.MOBILE,
                    "icon": "smartphone",
                    "confidence": 0.95,
                    "reasons": [f"OS fingerprint matched mobile: {os_clues}"]
                }
            if any(k in os_lower for k in ["routeros", "cisco ios", "vyos", "openwrt", "embedded", "screen"]):
                return {
                    "category": DeviceCategory.NETWORK_INFRASTRUCTURE,
                    "icon": "network",
                    "confidence": 0.95,
                    "reasons": [f"OS fingerprint matched infrastructure: {os_clues}"]
                }
            if any(k in os_lower for k in ["linux", "freebsd", "esxi", "solaris"]) and not any(k in os_lower for k in ["android"]):
                # Linux could be server, desktop or IoT
                pass

        # 3. Check Hostname patterns (High confidence)
        if hostname:
            for pattern, cat, ic in cls._HOSTNAME_RULES:
                if pattern.search(hostname):
                    reasons.append(f"Hostname '{hostname}' matched {cat.value} pattern")
                    return {
                        "category": cat,
                        "icon": "smartphone" if cat == DeviceCategory.MOBILE else ic,
                        "confidence": 0.85,
                        "reasons": reasons
                    }

        # 4. Check DHCP Vendor Class / options
        if dhcp_vendor:
            dhcp_lower = dhcp_vendor.lower()
            if "android" in dhcp_lower or "ios" in dhcp_lower or "iphone" in dhcp_lower:
                return {
                    "category": DeviceCategory.MOBILE,
                    "icon": "smartphone",
                    "confidence": 0.85,
                    "reasons": [f"DHCP option matched mobile: {dhcp_vendor}"]
                }
            if "msft" in dhcp_lower or "windows" in dhcp_lower:
                return {
                    "category": DeviceCategory.DESKTOP_LAPTOP,
                    "icon": "laptop",
                    "confidence": 0.8,
                    "reasons": [f"DHCP vendor matched Windows PC: {dhcp_vendor}"]
                }

        # 5. Check Open Ports
        if open_ports:
            ports_set = set(open_ports)
            # Web servers or admin ports
            if {80, 443, 22}.issubset(ports_set) or 8006 in ports_set or 8443 in ports_set or 9000 in ports_set:
                category = DeviceCategory.SERVER
                icon = "server"
                confidence = 0.7
                reasons.append(f"Server ports open: {sorted(list(ports_set))}")
            elif 53 in ports_set or 67 in ports_set or 161 in ports_set:
                category = DeviceCategory.NETWORK_INFRASTRUCTURE
                icon = "network"
                confidence = 0.75
                reasons.append(f"Network infrastructure ports open: {sorted(list(ports_set))}")
            elif 1883 in ports_set or 8883 in ports_set: # MQTT
                category = DeviceCategory.IOT_SMART_HOME
                icon = "cpu"
                confidence = 0.8
                reasons.append("MQTT IoT port open (1883/8883)")

        if category != DeviceCategory.UNKNOWN:
            return {
                "category": category,
                "icon": icon,
                "confidence": confidence,
                "reasons": reasons
            }

        # 6. Check Vendor OUI
        if vendor:
            v_lower = vendor.lower()
            for vendors, cat, ic in cls._VENDOR_RULES:
                if any(v in v_lower for v in vendors):
                    return {
                        "category": cat,
                        "icon": "smartphone" if cat == DeviceCategory.MOBILE else ic,
                        "confidence": 0.65,
                        "reasons": [f"Hardware OUI vendor '{vendor}' mapped to {cat.value}"]
                    }

            if "apple" in v_lower or "samsung" in v_lower:
                # Apple / Samsung could be Mobile or Desktop or TV
                return {
                    "category": DeviceCategory.MOBILE,
                    "icon": "smartphone",
                    "confidence": 0.5,
                    "reasons": [f"Vendor '{vendor}' heuristically assumed mobile default"]
                }
            elif "intel" in v_lower or "dell" in v_lower or "hewlett packard" in v_lower or "lenovo" in v_lower:
                return {
                    "category": DeviceCategory.DESKTOP_LAPTOP,
                    "icon": "laptop",
                    "confidence": 0.6,
                    "reasons": [f"Vendor '{vendor}' mapped to Desktop/Laptop"]
                }
            elif "sony" in v_lower:
                return {
                    "category": DeviceCategory.GAMING_MEDIA,
                    "icon": "tv",
                    "confidence": 0.55,
                    "reasons": [f"Vendor '{vendor}' mapped to Gaming/Media"]
                }

        # Default fallback
        if is_laa_randomized(mac):
            # Randomized MACs are almost exclusively modern phones/tablets
            return {
                "category": DeviceCategory.MOBILE,
                "icon": "smartphone",
                "confidence": 0.45,
                "reasons": ["LAA Randomized MAC commonly indicates mobile smartphone/tablet"]
            }

        return {
            "category": DeviceCategory.UNKNOWN,
            "icon": "help-circle",
            "confidence": 0.1,
            "reasons": ["Insufficient telemetry signals for definitive classification"]
        }


device_classifier = DeviceClassifier()
