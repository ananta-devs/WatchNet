import asyncio
from datetime import datetime, time, timezone
import ipaddress
import logging
import re
import socket
import struct
import uuid
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflows import WorkflowRule, WorkflowExecutionLog
from app.models.entities import Device, DeviceCategory
from app.services.notifications.notification_router import notification_router

logger = logging.getLogger(__name__)


def is_mac_randomized(mac_str: str) -> bool:
    """
    Check if a MAC address has the locally administered bit set (bit 1 of first byte).
    E.g. x2:xx:xx:xx:xx:xx, x6:..., xA:..., xE:...
    """
    try:
        clean = mac_str.replace(":", "").replace("-", "").strip()
        if len(clean) >= 2:
            first_byte = int(clean[:2], 16)
            return bool(first_byte & 0x02)
    except Exception:
        pass
    return False


def is_time_between(start_str: str, end_str: str, current_time: Optional[time] = None) -> bool:
    """
    Check if current UTC/local time is between start_str ("08:00") and end_str ("18:00").
    Supports overnight ranges (e.g. 22:00 to 06:00).
    """
    try:
        sh, sm = map(int, start_str.split(":"))
        eh, em = map(int, end_str.split(":"))
        t_start = time(sh, sm)
        t_end = time(eh, em)
        if current_time is None:
            current_time = datetime.now(timezone.utc).time()

        if t_start <= t_end:
            return t_start <= current_time <= t_end
        else:
            # Crosses midnight
            return current_time >= t_start or current_time <= t_end
    except Exception as e:
        logger.warning(f"Error evaluating time_between: {e}")
        return True


def send_magic_packet(mac_address: str, broadcast_ip: str = "255.255.255.255", port: int = 9) -> bool:
    """Send Wake-on-LAN magic packet."""
    try:
        clean_mac = mac_address.replace(":", "").replace("-", "").strip()
        if len(clean_mac) != 12:
            raise ValueError(f"Invalid MAC address for WoL: {mac_address}")
        mac_bytes = bytes.fromhex(clean_mac)
        magic = b"\xff" * 6 + mac_bytes * 16

        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.sendto(magic, (broadcast_ip, port))
        return True
    except Exception as e:
        logger.error(f"WoL packet sending failed: {e}")
        return False


class WorkflowEngine:
    """
    Event-driven automation runner evaluating incoming network events against user-defined workflow rules.
    """

    async def evaluate_condition(
        self,
        condition: Dict[str, Any],
        event_data: Dict[str, Any],
        device: Optional[Device] = None
    ) -> bool:
        """
        Evaluate a single condition against the event data and associated Device.
        Conditions:
          - vendor_equals / vendor_contains
          - category_equals
          - ip_in_cidr
          - mac_matches
          - is_randomized_mac
          - time_between
        """
        cond_type = condition.get("type", "")
        expected = condition.get("value")

        # 1. vendor_equals
        if cond_type == "vendor_equals":
            actual = (device.vendor if device else event_data.get("vendor", "")) or ""
            return actual.lower() == str(expected).lower()

        # 2. vendor_contains
        if cond_type == "vendor_contains":
            actual = (device.vendor if device else event_data.get("vendor", "")) or ""
            return str(expected).lower() in actual.lower()

        # 3. category_equals
        if cond_type == "category_equals":
            actual = ""
            if device:
                actual = device.category.value if hasattr(device.category, "value") else str(device.category)
            else:
                actual = event_data.get("category", "")
            return actual.lower() == str(expected).lower()

        # 4. ip_in_cidr
        if cond_type == "ip_in_cidr":
            ip_str = (
                (device.ipv4 or getattr(device, "ipv6", None)) if device
                else event_data.get("ip") or event_data.get("ipv4") or event_data.get("ipv6")
            ) or ""
            if not ip_str:
                return False
            try:
                network = ipaddress.ip_network(str(expected), strict=False)
                return ipaddress.ip_address(ip_str) in network
            except Exception:
                return False

        # 5. mac_matches
        if cond_type == "mac_matches":
            mac_str = (device.mac if device else event_data.get("mac", "")) or ""
            # Support wildcard like "AA:BB:*" or regex
            try:
                pattern = str(expected).replace("*", ".*")
                return bool(re.search(f"^{pattern}$", mac_str, re.IGNORECASE))
            except Exception:
                return False

        # 6. is_randomized_mac
        if cond_type == "is_randomized_mac":
            mac_str = (device.mac if device else event_data.get("mac", "")) or ""
            res = is_mac_randomized(mac_str)
            return res == bool(expected)

        # 7. time_between
        if cond_type == "time_between":
            start_t = condition.get("start") or ""
            end_t = condition.get("end") or ""
            # Fallback if provided as "22:00-06:00" in condition["value"]
            if not start_t or not end_t:
                val = str(condition.get("value", ""))
                if "-" in val:
                    parts = val.split("-")
                    start_t = parts[0].strip()
                    end_t = parts[1].strip()
                elif " to " in val.lower():
                    parts = re.split(r"\s+to\s+", val, flags=re.IGNORECASE)
                    start_t = parts[0].strip()
                    end_t = parts[1].strip()
            if not start_t:
                start_t = "00:00"
            if not end_t:
                end_t = "23:59"
            return is_time_between(start_t, end_t)

        return True

    async def execute_action(
        self,
        action: Dict[str, Any],
        session: AsyncSession,
        event_type: str,
        event_data: Dict[str, Any],
        device: Optional[Device] = None
    ) -> Dict[str, Any]:
        """
        Execute an automation action:
          - send_notification
          - assign_category
          - add_tag
          - set_device_name
          - archive_device
          - trigger_webhook
          - wake_on_lan
        """
        act_type = action.get("action", "")
        result_info = {"action": act_type, "status": "success"}

        # 1. send_notification (channel, message template)
        if act_type == "send_notification":
            title = action.get("title", f"Workflow Alert: {event_type}")
            msg = action.get("message", f"Workflow rule executed for event {event_type}")
            # Format message with device info if available
            if device:
                msg = msg.replace("{mac}", device.mac or "").replace("{name}", device.name or "").replace("{ip}", device.ipv4 or "")
            sev = action.get("severity", "INFO")
            res = await notification_router.dispatch(
                session=session,
                title=title,
                message=msg,
                severity=sev,
                event_type=event_type,
                device_id=str(device.id) if device else None,
                data=event_data,
                bypass_suppression=True  # Explicit rule execution
            )
            result_info["dispatch_result"] = res

        # 2. assign_category
        elif act_type == "assign_category" and device:
            cat_name = action.get("category", "")
            for member in DeviceCategory:
                if member.value.lower() == cat_name.lower():
                    device.category = member
                    break
            result_info["new_category"] = str(device.category.value if hasattr(device.category, "value") else device.category)

        # 3. add_tag
        elif act_type == "add_tag" and device:
            tag = action.get("tag", "")
            if tag:
                props = dict(device.custom_properties or {})
                tags = list(props.get("tags", []))
                if tag not in tags:
                    tags.append(tag)
                    props["tags"] = tags
                    device.custom_properties = props
                    result_info["tags"] = tags

        # 4. set_device_name
        elif act_type == "set_device_name" and device:
            new_name = action.get("name", "")
            if new_name:
                device.name = new_name
                result_info["name"] = new_name

        # 5. archive_device
        elif act_type == "archive_device" and device:
            device.is_archived = True
            result_info["is_archived"] = True

        # 6. trigger_webhook (URL, payload)
        elif act_type == "trigger_webhook":
            url = action.get("url", "")
            custom_payload = action.get("payload", {})
            if url:
                try:
                    payload_to_send = dict(custom_payload)
                    payload_to_send.update({
                        "event_type": event_type,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "event_data": event_data
                    })
                    if device:
                        payload_to_send["device"] = {
                            "id": str(device.id),
                            "mac": device.mac,
                            "name": device.name,
                            "ip": device.ipv4
                        }
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.post(url, json=payload_to_send)
                        result_info["response_code"] = resp.status_code
                except Exception as ex:
                    logger.error(f"Action trigger_webhook failed: {ex}")
                    result_info["status"] = "failed"
                    result_info["error"] = str(ex)

        # 7. wake_on_lan (MAC address, broadcast IP)
        elif act_type == "wake_on_lan":
            mac_target = action.get("mac") or (device.mac if device else None)
            bcast = action.get("broadcast_ip", "255.255.255.255")
            if mac_target:
                ok = await asyncio.to_thread(send_magic_packet, mac_target, bcast)
                result_info["wol_sent"] = ok
            else:
                result_info["status"] = "failed"
                result_info["error"] = "No MAC specified for WoL action"

        return result_info

    async def run_workflows_for_event(
        self,
        session: AsyncSession,
        event_type: str,
        event_data: Dict[str, Any],
        device_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Main runner: Fetch enabled rules for trigger_event, test all conditions, execute actions.
        """
        # Fetch device if device_id provided
        device: Optional[Device] = None
        if device_id:
            try:
                dev_uuid = uuid.UUID(str(device_id))
                device = await session.get(Device, dev_uuid)
            except Exception as e:
                logger.warning(f"Error fetching device for workflow: {e}")

        # Fetch matching active rules
        stmt = select(WorkflowRule).where(
            and_(
                WorkflowRule.is_enabled == True,
                WorkflowRule.trigger_event == event_type
            )
        )
        result = await session.execute(stmt)
        rules = result.scalars().all()

        executed_reports = []

        for rule in rules:
            conditions = rule.conditions_json or []
            actions = rule.actions_json or []

            # Evaluate all conditions (AND conjunction)
            all_match = True
            for cond in conditions:
                matched = await self.evaluate_condition(cond, event_data, device)
                if not matched:
                    all_match = False
                    break

            if not all_match:
                continue

            # Conditions passed! Execute actions
            action_results = []
            error_msg = None
            for act in actions:
                try:
                    res = await self.execute_action(act, session, event_type, event_data, device)
                    action_results.append(res)
                except Exception as e:
                    logger.error(f"Rule '{rule.name}' action execution error: {e}")
                    error_msg = str(e)
                    action_results.append({"action": act.get("action"), "status": "failed", "error": str(e)})

            # Update rule execution metrics
            rule.execution_count = (rule.execution_count or 0) + 1
            rule.last_triggered_at = datetime.now(timezone.utc)

            # Record Execution Log
            log_entry = WorkflowExecutionLog(
                rule_id=rule.id,
                trigger_event=event_type,
                matched=True,
                actions_executed=action_results,
                error_message=error_msg,
                executed_at=datetime.now(timezone.utc)
            )
            session.add(log_entry)
            await session.commit()

            executed_reports.append({
                "rule_id": str(rule.id),
                "rule_name": rule.name,
                "actions_executed": action_results,
                "error": error_msg
            })

        return executed_reports


workflow_engine = WorkflowEngine()
