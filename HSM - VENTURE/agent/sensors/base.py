"""
Base Collector Interface for TechDef Hardware Sensors
"""
from abc import ABC, abstractmethod
from typing import Any, Dict

class BaseSensorCollector(ABC):
    @abstractmethod
    def collect(self) -> Dict[str, Any]:
        """Collect and return sensor data dictionary."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the collector."""
        pass
