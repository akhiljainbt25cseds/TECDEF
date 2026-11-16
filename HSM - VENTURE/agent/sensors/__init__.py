"""
Sensor Manager: Aggregates all sensor collectors into a unified live metrics snapshot.
"""
import time
import platform
from collections import deque
from typing import Any, Dict, List
from .mock import MockSensorCollector
from .cpu import CpuCollector
from .gpu import GpuCollector
from .lhm import LibreHardwareMonitorCollector
from .memory_disk import MemoryDiskCollector
from .network import NetworkCollector
from .games import GameProcessDetector
from .macos import MacHardwareCollector

class SensorManager:
    def __init__(self, mock_mode: bool = False, lhm_url: str = "http://localhost:8085/data.json", monitored_games: List[str] = None):
        self.mock_mode = mock_mode
        self.is_macos = platform.system() == "Darwin"
        self.history: deque = deque(maxlen=60) # Last 60 seconds rolling metrics

        if self.is_macos:
            self.mac_collector = MacHardwareCollector(monitored_games=monitored_games)
        elif mock_mode:
            self.mock_collector = MockSensorCollector()
        else:
            self.cpu_collector = CpuCollector()
            self.gpu_collector = GpuCollector()
            self.lhm_collector = LibreHardwareMonitorCollector(endpoint_url=lhm_url)
            self.mem_disk_collector = MemoryDiskCollector()
            self.net_collector = NetworkCollector()
            self.game_detector = GameProcessDetector(monitored_games=monitored_games)

    def get_snapshot(self) -> Dict[str, Any]:
        if self.is_macos:
            snapshot = self.mac_collector.collect()
        elif self.mock_mode:
            snapshot = self.mock_collector.collect()
        else:
            cpu_data = self.cpu_collector.collect()
            gpu_data = self.gpu_collector.collect()
            lhm_data = self.lhm_collector.collect()
            mem_disk_data = self.mem_disk_collector.collect()
            net_data = self.net_collector.collect()
            game_data = self.game_detector.collect()

            # Merge fans from LHM or GPU
            fans = lhm_data.get("fans", [])
            if not any("gpu" in f.get("name", "").lower() for f in fans) and "fan_speed_pct" in gpu_data:
                fans.append({
                    "id": "gpu_fan_default",
                    "name": "GPU Cooler Fan",
                    "rpm": int(gpu_data.get("fan_speed_pct", 50) * 35),
                    "control_supported": True
                })

            # Battery check
            battery_info = None
            try:
                import psutil
                if hasattr(psutil, "sensors_battery"):
                    bat = psutil.sensors_battery()
                    if bat:
                        battery_info = {
                            "percent": bat.percent,
                            "power_plugged": bat.power_plugged,
                            "secsleft": bat.secsleft if bat.secsleft != -1 else None
                        }
            except Exception:
                pass

            snapshot = {
                "timestamp": time.time(),
                "cpu": cpu_data,
                "gpu": gpu_data,
                "ram": mem_disk_data["ram"],
                "disk": mem_disk_data["disk"],
                "network": net_data,
                "fans": fans,
                "battery": battery_info,
                "gaming": game_data,
                "capabilities": {
                    "fan_control": lhm_data.get("available", False),
                    "gpu_power_limit": True,
                    "os_platform": f"{platform.system()} {platform.release()}",
                    "admin_rights": True,
                    "mode": "real"
                }
            }

        self.history.append(snapshot)
        return snapshot

    def get_history(self) -> List[Dict[str, Any]]:
        return list(self.history)
