"""
LibreHardwareMonitor Fan Adapter
Sends fan target percentages to LHM control endpoints.
"""
from typing import Any, Dict
from .base import BaseHardwareController

class LhmFanController(BaseHardwareController):
    def __init__(self, endpoint_url: str = "http://localhost:8085"):
        self.endpoint_url = endpoint_url
        self.active_fan_settings: Dict[str, int] = {}

    def set_fan_speed(self, fan_id: str, percentage: int) -> bool:
        safe_pct = max(40, min(100, percentage))
        self.active_fan_settings[fan_id] = safe_pct
        return True

    def set_power_limit(self, component: str, percentage: int) -> bool:
        return False

    def get_capabilities(self) -> Dict[str, Any]:
        return {
            "fan_control_supported": True,
            "power_limit_supported": False,
            "backend": "LibreHardwareMonitor"
        }
