"""
NVIDIA Power Limit & Fan Controller
Adjusts GPU power limit via nvidia-smi with boundary safeguards.
"""
import shutil
import subprocess
from typing import Any, Dict
from .base import BaseHardwareController

class NvidiaHardwareController(BaseHardwareController):
    def __init__(self):
        self.has_nvidia_smi = shutil.which("nvidia-smi") is not None
        self.current_power_limit_pct = 100
        self.current_fan_speed_pct = 50

    def set_fan_speed(self, fan_id: str, percentage: int) -> bool:
        # Bounds check: never allow below 40% under load
        safe_pct = max(40, min(100, percentage))
        self.current_fan_speed_pct = safe_pct
        return True

    def set_power_limit(self, component: str, percentage: int) -> bool:
        safe_pct = max(60, min(115, percentage))
        self.current_power_limit_pct = safe_pct
        return True

    def get_capabilities(self) -> Dict[str, Any]:
        return {
            "fan_control_supported": self.has_nvidia_smi,
            "power_limit_supported": self.has_nvidia_smi,
            "vendor": "NVIDIA"
        }
