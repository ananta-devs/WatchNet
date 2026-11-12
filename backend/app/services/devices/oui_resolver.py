"""
IEEE OUI Database Parser and MAC Manufacturer Resolver.
Provides sub-millisecond offline lookup of hardware manufacturers from MAC addresses,
handles RFC 7042 Locally Administered Address (LAA) private/randomized MAC detection,
and normalizes MAC formats.
"""
import re
from typing import Optional, Dict, Tuple

# Comprehensive IEEE OUI manufacturer registry
DEFAULT_OUI_DATABASE: Dict[str, str] = {
    # Apple
    "00:03:93": "Apple, Inc.",
    "00:05:02": "Apple, Inc.",
    "00:0a:27": "Apple, Inc.",
    "00:10:fa": "Apple, Inc.",
    "00:14:51": "Apple, Inc.",
    "00:16:cb": "Apple, Inc.",
    "00:17:f2": "Apple, Inc.",
    "00:19:e3": "Apple, Inc.",
    "00:1b:63": "Apple, Inc.",
    "00:1c:b3": "Apple, Inc.",
    "00:1d:4f": "Apple, Inc.",
    "00:1e:52": "Apple, Inc.",
    "00:1e:c2": "Apple, Inc.",
    "00:1f:5b": "Apple, Inc.",
    "00:1f:f3": "Apple, Inc.",
    "00:21:e9": "Apple, Inc.",
    "00:22:41": "Apple, Inc.",
    "00:23:12": "Apple, Inc.",
    "00:23:32": "Apple, Inc.",
    "00:23:6c": "Apple, Inc.",
    "00:24:36": "Apple, Inc.",
    "00:25:00": "Apple, Inc.",
    "00:25:4b": "Apple, Inc.",
    "00:25:bc": "Apple, Inc.",
    "00:26:08": "Apple, Inc.",
    "00:26:4a": "Apple, Inc.",
    "00:26:b0": "Apple, Inc.",
    "28:cf:da": "Apple, Inc.",
    "3c:07:54": "Apple, Inc.",
    "40:6c:8f": "Apple, Inc.",
    "60:f8:1d": "Apple, Inc.",
    "70:3e:ac": "Apple, Inc.",
    "88:66:5a": "Apple, Inc.",
    "ac:bc:32": "Apple, Inc.",
    "bc:d0:74": "Apple, Inc.",
    "f4:5c:89": "Apple, Inc.",

    # Samsung
    "00:00:f0": "Samsung Electronics",
    "00:02:78": "Samsung Electronics",
    "00:07:ab": "Samsung Electronics",
    "00:09:18": "Samsung Electronics",
    "00:0d:ae": "Samsung Electronics",
    "00:12:47": "Samsung Electronics",
    "00:12:fb": "Samsung Electronics",
    "00:15:99": "Samsung Electronics",
    "00:15:b9": "Samsung Electronics",
    "00:16:32": "Samsung Electronics",
    "14:bb:6e": "Samsung Electronics",
    "34:c0:59": "Samsung Electronics",
    "50:01:d9": "Samsung Electronics",
    "94:65:2d": "Samsung Electronics",
    "a8:06:00": "Samsung Electronics",
    "cc:07:ab": "Samsung Electronics",

    # Espressif (ESP8266 / ESP32 IoT)
    "18:fe:34": "Espressif Inc.",
    "24:0a:c4": "Espressif Inc.",
    "24:6f:28": "Espressif Inc.",
    "24:b2:de": "Espressif Inc.",
    "2c:3a:e8": "Espressif Inc.",
    "30:ae:a4": "Espressif Inc.",
    "3c:71:bf": "Espressif Inc.",
    "40:22:d8": "Espressif Inc.",
    "48:e7:29": "Espressif Inc.",
    "54:43:b2": "Espressif Inc.",
    "84:0d:8e": "Espressif Inc.",
    "84:f3:eb": "Espressif Inc.",
    "a0:20:a6": "Espressif Inc.",
    "a4:e5:7c": "Espressif Inc.",
    "bc:dd:c2": "Espressif Inc.",
    "c4:4f:33": "Espressif Inc.",

    # Raspberry Pi
    "b8:27:eb": "Raspberry Pi Foundation",
    "dc:a6:32": "Raspberry Pi Trading Ltd",
    "e4:5f:01": "Raspberry Pi Trading Ltd",
    "28:cd:c1": "Raspberry Pi Ltd",
    "d8:3a:dd": "Raspberry Pi Trading Ltd",

    # Intel
    "00:02:b3": "Intel Corporation",
    "00:03:47": "Intel Corporation",
    "00:04:23": "Intel Corporation",
    "00:07:e9": "Intel Corporation",
    "00:0e:0c": "Intel Corporation",
    "00:11:11": "Intel Corporation",
    "00:13:02": "Intel Corporation",
    "00:13:20": "Intel Corporation",
    "00:15:00": "Intel Corporation",
    "00:16:76": "Intel Corporation",
    "00:18:de": "Intel Corporation",
    "00:1b:21": "Intel Corporation",
    "34:13:e8": "Intel Corporation",
    "48:51:b7": "Intel Corporation",
    "80:86:f2": "Intel Corporation",

    # TP-Link
    "00:1d:0f": "TP-Link Technologies Co., Ltd.",
    "00:21:27": "TP-Link Technologies Co., Ltd.",
    "00:23:cd": "TP-Link Technologies Co., Ltd.",
    "14:cf:92": "TP-Link Technologies Co., Ltd.",
    "1c:3b:f3": "TP-Link Technologies Co., Ltd.",
    "30:b5:c2": "TP-Link Technologies Co., Ltd.",
    "50:c7:bf": "TP-Link Technologies Co., Ltd.",
    "60:e3:27": "TP-Link Technologies Co., Ltd.",
    "84:16:f9": "TP-Link Technologies Co., Ltd.",
    "98:de:d0": "TP-Link Technologies Co., Ltd.",
    "c0:25:e9": "TP-Link Technologies Co., Ltd.",
    "e4:c3:2a": "TP-Link Technologies Co., Ltd.",

    # Ubiquiti Networks
    "00:15:6d": "Ubiquiti Networks Inc.",
    "00:27:22": "Ubiquiti Networks Inc.",
    "04:18:d6": "Ubiquiti Networks Inc.",
    "24:a4:3c": "Ubiquiti Networks Inc.",
    "44:d9:e7": "Ubiquiti Networks Inc.",
    "68:d7:9a": "Ubiquiti Networks Inc.",
    "74:83:c2": "Ubiquiti Networks Inc.",
    "78:8a:20": "Ubiquiti Networks Inc.",
    "80:2a:a8": "Ubiquiti Networks Inc.",
    "b4:fb:e4": "Ubiquiti Networks Inc.",
    "dc:9f:db": "Ubiquiti Networks Inc.",
    "e0:63:da": "Ubiquiti Networks Inc.",
    "f0:9f:c2": "Ubiquiti Networks Inc.",

    # Cisco
    "00:00:0c": "Cisco Systems, Inc.",
    "00:01:42": "Cisco Systems, Inc.",
    "00:01:43": "Cisco Systems, Inc.",
    "00:01:63": "Cisco Systems, Inc.",
    "00:01:64": "Cisco Systems, Inc.",
    "00:01:96": "Cisco Systems, Inc.",
    "00:01:97": "Cisco Systems, Inc.",
    "00:02:16": "Cisco Systems, Inc.",
    "00:02:17": "Cisco Systems, Inc.",
    "00:02:4a": "Cisco Systems, Inc.",
    "00:02:4b": "Cisco Systems, Inc.",

    # Google
    "00:1a:11": "Google, Inc.",
    "18:d6:c7": "Google, Inc.",
    "20:df:b9": "Google, Inc.",
    "3c:5a:37": "Google, Inc.",
    "54:60:09": "Google, Inc.",
    "74:c6:3b": "Google, Inc.",
    "94:eb:cd": "Google, Inc.",
    "a4:77:33": "Google, Inc.",
    "f4:03:04": "Google, Inc.",

    # Amazon
    "00:fc:8b": "Amazon Technologies Inc.",
    "38:f7:3d": "Amazon Technologies Inc.",
    "40:b4:cd": "Amazon Technologies Inc.",
    "44:65:0d": "Amazon Technologies Inc.",
    "50:dc:e7": "Amazon Technologies Inc.",
    "68:37:e9": "Amazon Technologies Inc.",
    "74:c2:46": "Amazon Technologies Inc.",
    "ac:63:be": "Amazon Technologies Inc.",
    "fc:a6:67": "Amazon Technologies Inc.",

    # Microsoft
    "00:12:5a": "Microsoft Corporation",
    "00:15:5d": "Microsoft Corporation",  # Hyper-V
    "00:17:fa": "Microsoft Corporation",
    "00:1d:d8": "Microsoft Corporation",
    "28:18:78": "Microsoft Corporation",
    "70:32:17": "Microsoft Corporation",
    "7c:1e:52": "Microsoft Corporation",
    "98:5f:d3": "Microsoft Corporation",
    "dc:98:40": "Microsoft Corporation",

    # VMware
    "00:05:69": "VMware, Inc.",
    "00:0c:29": "VMware, Inc.",
    "00:1c:14": "VMware, Inc.",
    "00:50:56": "VMware, Inc.",

    # Proxmox / QEMU
    "52:54:00": "QEMU Virtual NIC",
    "bc:24:11": "Proxmox Server Solutions",

    # Netgear
    "00:09:5b": "Netgear",
    "00:0f:b5": "Netgear",
    "00:14:6c": "Netgear",
    "00:18:4d": "Netgear",
    "00:1b:2f": "Netgear",
    "00:1e:2a": "Netgear",
    "00:1f:33": "Netgear",
    "00:22:3f": "Netgear",
    "00:24:b2": "Netgear",
    "00:26:f2": "Netgear",

    # MikroTik
    "00:0c:42": "MikroTik",
    "08:55:31": "MikroTik",
    "18:fd:74": "MikroTik",
    "2c:c8:1b": "MikroTik",
    "48:8f:5a": "MikroTik",
    "64:d1:54": "MikroTik",
    "74:4d:28": "MikroTik",
    "b8:69:f4": "MikroTik",
    "c4:ad:34": "MikroTik",
    "cc:2d:e0": "MikroTik",
    "dc:2c:6e": "MikroTik",

    # Synology / QNAP
    "00:11:32": "Synology Incorporated",
    "00:08:9b": "QNAP Systems, Inc.",

    # Sonos
    "00:0e:58": "Sonos, Inc.",
    "48:a6:b8": "Sonos, Inc.",
    "5c:aa:fd": "Sonos, Inc.",
    "78:28:ca": "Sonos, Inc.",
    "94:9f:3e": "Sonos, Inc.",
    "b8:e9:37": "Sonos, Inc.",

    # Dell / HP / Sony / Nintendo
    "00:06:5b": "Dell Inc.",
    "00:08:74": "Dell Inc.",
    "00:14:22": "Dell Inc.",
    "00:01:e6": "Hewlett Packard Enterprise",
    "00:0b:cd": "Hewlett Packard Enterprise",
    "00:01:4a": "Sony Corporation",
    "00:13:15": "Sony Corporation",
    "00:09:bf": "Nintendo Co., Ltd.",
    "00:1f:32": "Nintendo Co., Ltd.",
    "98:b6:e9": "Nintendo Co., Ltd.",
}


def normalize_mac(mac: str) -> str:
    """Normalizes MAC string to lowercase colon-separated format aa:bb:cc:dd:ee:ff."""
    clean = re.sub(r"[^0-9a-fA-F]", "", mac).lower()
    if len(clean) != 12:
        return mac.lower().strip()
    return ":".join(clean[i : i + 2] for i in range(0, 12, 2))


def is_laa_randomized(mac: str) -> bool:
    """
    Checks RFC 7042 Locally Administered Address (LAA) bit.
    Bit 1 of byte 0 set indicates private/randomized virtual MAC (iOS, Android, Windows, etc.).
    """
    clean = re.sub(r"[^0-9a-fA-F]", "", mac)
    if len(clean) < 2:
        return False
    try:
        first_byte = int(clean[:2], 16)
        return bool(first_byte & 0x02)
    except ValueError:
        return False


class OUIResolver:
    """Offline OUI prefix resolver with LAA randomized MAC detection and custom registry extension."""

    def __init__(self, custom_prefixes: Optional[Dict[str, str]] = None):
        self._database = dict(DEFAULT_OUI_DATABASE)
        if custom_prefixes:
            for k, v in custom_prefixes.items():
                self._database[normalize_mac(k)[:8]] = v

    def lookup(self, mac: str) -> Tuple[Optional[str], bool]:
        """
        Resolves manufacturer and returns (vendor_name, is_randomized).
        """
        is_random = is_laa_randomized(mac)
        if is_random:
            return "Randomized / Private MAC", True

        norm = normalize_mac(mac)
        prefix = norm[:8]
        vendor = self._database.get(prefix)
        return vendor, False

    def resolve_vendor(self, mac: str) -> Optional[str]:
        """Convenience method returning vendor or fallback."""
        vendor, is_random = self.lookup(mac)
        return vendor


oui_resolver = OUIResolver()
