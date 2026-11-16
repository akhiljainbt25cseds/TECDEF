"""
Mock Sensor Collector for Demonstration & Hardware-Independent Testing
Simulates realistic gaming workloads with fluctuating temperatures, fan RPMs, power, and FPS.
"""
import math
import time
import random
import platform
from typing import Any, Dict
from .base import BaseSensorCollector

class MockSensorCollector(BaseSensorCollector):
    def __init__(self, simulate_game: bool = False):
        self._start_time = time.time()
        self._step = 0
        self.simulated_game = "Cyberpunk 2077 (cyberpunk2077.exe)" if simulate_game else None
        self.game_running = simulate_game

    @property
    def name(self) -> str:
        return "mock"

    def collect(self) -> Dict[str, Any]:
        self._step += 1
        elapsed = time.time() - self._start_time

        # Smooth sine-based fluctuations with realistic random noise
        wave = math.sin(elapsed / 12.0)
        thermal_spike = 10.0 if (self._step % 45 > 35) else 0.0

        cpu_temp = round(68.0 + (wave * 8.0) + thermal_spike + random.uniform(-1.5, 1.5), 1)
        gpu_temp = round(64.0 + (wave * 9.0) + thermal_spike + random.uniform(-1.2, 1.2), 1)

        cpu_usage = round(min(100.0, max(15.0, 62.0 + (wave * 20.0) + random.uniform(-5.0, 5.0))), 1)
        gpu_usage = round(min(100.0, max(30.0, 88.0 + (wave * 8.0) + random.uniform(-3.0, 3.0))), 1)

        cpu_power = round(65.0 + (wave * 20.0) + random.uniform(-3.0, 3.0), 1)
        gpu_power = round(175.0 + (wave * 35.0) + random.uniform(-5.0, 5.0), 1)

        # Realistic fan RPM dynamically scaling with temperature
        fan_ratio = max(0.4, min(1.0, (max(cpu_temp, gpu_temp) - 50.0) / 45.0))
        cpu_fan_rpm = int(1200 + (fan_ratio * 1600) + random.randint(-25, 25))
        gpu_fan_rpm = int(1400 + (fan_ratio * 1800) + random.randint(-30, 30))

        # FPS & Frametime
        fps = int(144 + (wave * 12) + random.randint(-4, 4))
        frametime_ms = round(1000.0 / max(1, fps), 2)

        is_mac = platform.system() == "Darwin"
        cpu_name = "Apple M5 (10-Core Apple Silicon SoC)" if is_mac else "AMD Ryzen 5 7520U with Radeon Graphics (8 Threads)"
        gpu_name = "Apple M5 Integrated GPU (16GB Unified Memory)" if is_mac else "AMD Radeon(TM) Graphics (Integrated)"

        return {
            "timestamp": time.time(),
            "cpu": {
                "name": cpu_name,
                "package_temp_c": cpu_temp,
                "cores_temp_c": [round(cpu_temp + random.uniform(-3.0, 3.0), 1) for _ in range(8)],
                "usage_pct": cpu_usage,
                "per_core_usage": [round(min(100.0, max(5.0, cpu_usage + random.uniform(-15.0, 15.0))), 1) for _ in range(8)],
                "clock_mhz": int(3800 + random.randint(-50, 50)) if is_mac else int(4850 + random.randint(-50, 50)),
                "power_watts": round(cpu_power * 0.35, 1) if is_mac else cpu_power,
                "is_throttling": cpu_temp >= 90.0
            },
            "gpu": {
                "name": gpu_name,
                "core_temp_c": gpu_temp,
                "hotspot_temp_c": round(gpu_temp + 11.5, 1),
                "usage_pct": gpu_usage,
                "vram_used_mb": 9420 + random.randint(-50, 50),
                "vram_total_mb": 16384,
                "vram_pct": round((9420 / 16384) * 100, 1),
                "clock_mhz": int(2550 + random.randint(-30, 30)),
                "power_watts": gpu_power,
                "power_limit_pct": 100,
                "fan_speed_pct": int(fan_ratio * 100),
                "is_throttling": gpu_temp >= 88.0
            },
            "ram": {
                "used_gb": round(18.4 + random.uniform(-0.2, 0.2), 2),
                "total_gb": 32.0,
                "usage_pct": 57.5
            },
            "disk": {
                "used_gb": 1280.4,
                "total_gb": 2048.0,
                "usage_pct": 62.5,
                "read_speed_mbps": round(14.5 + (wave * 8.0) + random.uniform(0, 5), 1),
                "write_speed_mbps": round(4.2 + random.uniform(0, 3), 1)
            },
            "network": {
                "down_mbps": round(24.8 + random.uniform(-2, 5), 1),
                "up_mbps": round(4.5 + random.uniform(-1, 2), 1),
                "ping_ms": int(18 + random.randint(-2, 4)),
                "online": True
            },
            "fans": [
                {"id": "cpu_fan", "name": "CPU Cooler (AIO Pump)", "rpm": cpu_fan_rpm, "control_supported": True},
                {"id": "gpu_fan_1", "name": "GPU Fan 1", "rpm": gpu_fan_rpm, "control_supported": True},
                {"id": "gpu_fan_2", "name": "GPU Fan 2", "rpm": gpu_fan_rpm - 35, "control_supported": True},
                {"id": "case_intake", "name": "Chassis Intake (Front)", "rpm": int(950 + (fan_ratio * 600)), "control_supported": True},
                {"id": "case_exhaust", "name": "Chassis Exhaust (Rear)", "rpm": int(1100 + (fan_ratio * 550)), "control_supported": True}
            ],
            "battery": None, # Desktop gaming rig
            "gaming": {
                "game_running": self.game_running,
                "active_game": self.simulated_game if self.game_running else None,
                "fps": fps if self.game_running else None,
                "frametime_ms": frametime_ms if self.game_running else None
            },
            "capabilities": {
                "fan_control": True,
                "gpu_power_limit": True,
                "os_platform": "Windows 11 / x86_64",
                "admin_rights": True,
                "mode": "mock"
            }
        }
