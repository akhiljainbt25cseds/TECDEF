"""
LibreHardwareMonitor (LHM) Connector
Queries LHM's local JSON HTTP API (default http://localhost:8085/data.json)
for fan RPMs, motherboard telemetry, and hardware voltages.
"""
import time
import json
import urllib.request
from typing import Any, Dict, List
from .base import BaseSensorCollector

class LibreHardwareMonitorCollector(BaseSensorCollector):
    def __init__(self, endpoint_url: str = "http://localhost:8085/data.json", timeout: float = 0.3):
        self.endpoint_url = endpoint_url
        self.timeout = timeout
        self.available = False
        self._last_try = 0.0

    @property
    def name(self) -> str:
        return "libre_hardware_monitor"

    def collect(self) -> Dict[str, Any]:
        fans: List[Dict[str, Any]] = []
        temps: Dict[str, float] = {}
        now = time.time()

        # If unavailable, only re-probe every 8 seconds so we don't stall the telemetry loop
        if self.available or (now - self._last_try >= 8.0):
            self._last_try = now
            try:
                req = urllib.request.Request(self.endpoint_url, headers={"User-Agent": "TechDef/1.0"})
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode("utf-8"))
                        self.available = True
                        self._parse_tree(data, fans, temps)
            except Exception:
                self.available = False

        if not fans:
            # Fallback simulated fans if LHM is not running yet
            fans = [
                {"id": "fan_cpu", "name": "CPU Cooler Fan", "rpm": 1850, "control_supported": True},
                {"id": "fan_case_1", "name": "Chassis Intake", "rpm": 1400, "control_supported": True}
            ]

        return {
            "available": self.available,
            "fans": fans,
            "extra_temps": temps
        }

    def _parse_tree(self, node: Dict[str, Any], fans: List[Dict[str, Any]], temps: Dict[str, float]) -> None:
        text = node.get("Text", "")
        value = node.get("Value", "")
        node_id = str(node.get("id", ""))

        if "RPM" in value or "Fan" in text:
            # Try parse numeric RPM
            rpm_str = value.replace("RPM", "").replace(",", "").strip()
            try:
                rpm_val = int(float(rpm_str))
                fans.append({
                    "id": node_id or f"fan_{len(fans)}",
                    "name": text or "Chassis Fan",
                    "rpm": rpm_val,
                    "control_supported": True
                })
            except ValueError:
                pass

        if "°C" in value:
            temp_str = value.replace("°C", "").strip()
            try:
                temps[text] = float(temp_str)
            except ValueError:
                pass

        # Recurse children
        for child in node.get("Children", []):
            if isinstance(child, dict):
                self._parse_tree(child, fans, temps)
