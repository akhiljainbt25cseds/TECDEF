"""
Base Hardware Controller Interface
Defines fan and power limit adjustments with strict safety validation.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict

class BaseHardwareController(ABC):
    @abstractmethod
    def set_fan_speed(self, fan_id: str, percentage: int) -> bool:
        """Set fan speed percentage safely."""
        pass

    @abstractmethod
    def set_power_limit(self, component: str, percentage: int) -> bool:
        """Set power limit percentage safely."""
        pass

    @abstractmethod
    def get_capabilities(self) -> Dict[str, Any]:
        """Return controller capabilities and supported hardware."""
        pass
