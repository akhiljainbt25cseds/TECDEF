"""
Configuration Manager for TechDef Agent
Loads config.yaml with fallback to defaults, supporting updates and persistent saves.
"""
import os
import json
from pathlib import Path
from typing import Any, Dict

DEFAULT_CONFIG: Dict[str, Any] = {
    "server": {
        "host": "127.0.0.1",
        "port": 8765,
        "token": "techdef-gamer-secret-token",
        "stream_interval_seconds": 1.0
    },
    "safety": {
        "fan_control_enabled": True,
        "min_safe_fan_pct": 0,
        "max_fan_pct": 100,
        "hysteresis_seconds": 30,
        "warning_dwell_seconds": 5
    },
    "thresholds": {
        "cpu_warn_c": 80.0,
        "cpu_crit_c": 92.0,
        "cpu_safe_c": 72.0,
        "gpu_warn_c": 80.0,
        "gpu_crit_c": 90.0,
        "gpu_safe_c": 70.0
    },
    "active_profile": "auto",
    "profiles": {
        "silent": {"fan_target_pct": 45, "power_limit_pct": 80, "fps_cap": 60},
        "balanced": {"fan_target_pct": 65, "power_limit_pct": 100, "fps_cap": 120},
        "performance": {"fan_target_pct": 90, "power_limit_pct": 110, "fps_cap": 0},
        "auto": {"game_detected_profile": "performance", "idle_profile": "balanced"}
    },
    "game_processes": [
        "cs2.exe", "valorant.exe", "cyberpunk2077.exe", "eldenring.exe",
        "fortniteclient-win64-shipping.exe", "cod.exe", "apexlegends.exe"
    ],
    "libre_hardware_monitor": {
        "url": "http://localhost:8085/data.json",
        "timeout_seconds": 1.5
    }
}

class ConfigManager:
    def __init__(self, config_path: str | None = None):
        if config_path:
            self.config_path = Path(config_path)
        else:
            self.config_path = Path(__file__).parent / "config.yaml"
        self._data: Dict[str, Any] = self._load()

    def _load(self) -> Dict[str, Any]:
        data = dict(DEFAULT_CONFIG)
        if self.config_path.exists():
            try:
                import yaml
                with open(self.config_path, "r", encoding="utf-8") as f:
                    loaded = yaml.safe_load(f)
                    if isinstance(loaded, dict):
                        self._deep_merge(data, loaded)
            except Exception:
                # Fallback if pyyaml is missing: check for json or keep defaults
                pass
        return data

    def _deep_merge(self, base: dict, override: dict) -> None:
        for k, v in override.items():
            if k in base and isinstance(base[k], dict) and isinstance(v, dict):
                self._deep_merge(base[k], v)
            else:
                base[k] = v

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self._data[key] = value

    @property
    def data(self) -> Dict[str, Any]:
        return self._data

    def save(self) -> bool:
        try:
            import yaml
            with open(self.config_path, "w", encoding="utf-8") as f:
                yaml.dump(self._data, f, default_flow_style=False)
            return True
        except Exception:
            return False
