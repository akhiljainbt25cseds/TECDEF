"""
Safe Fallback Hardware Controller
Used when hardware writing is disabled or unsupported. Dispatches alerts without risking hardware.
"""
from typing import Any, Dict
from .base import BaseHardwareController

class SafeFallbackController(BaseHardwareController):
    def __init__(self):
        self.last_attempted_fan: Dict[str, int] = {}
        self.last_attempted_power: Dict[str, int] = {}

    def set_fan_speed(self, fan_id: str, percentage: int) -> bool:
        self.last_attempted_fan[fan_id] = percentage
        return True

    def set_power_limit(self, component: str, percentage: int) -> bool:
        self.last_attempted_power[component] = percentage
        return True

    def get_capabilities(self) -> Dict[str, Any]:
        return {
            "fan_control_supported": False,
            "power_limit_supported": False,
            "reason": "Safe fallback / read-only mode"
        }
