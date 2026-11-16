"""
TechDef Pro: Fan Control Service
Manual fan speed control with temperature-based recommendations.
Works on Windows via hardware controller; falls back to recommendation-only mode.
"""
import sys
import time
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional


# ── Fan Speed Recommendation Table ─────────────────────────────────────────
# Maps temperature ranges to recommended fan speeds with reasoning.
FAN_RECOMMENDATION_TABLE = [
    {
        "temp_min": 0,   "temp_max": 50,
        "recommended_pct": 30,
        "label": "Idle / Cool",
        "reason": "Temperatures are low. Minimal fan activity needed to stay quiet.",
        "color": "teal"
    },
    {
        "temp_min": 50,  "temp_max": 65,
        "recommended_pct": 45,
        "label": "Light Load",
        "reason": "Normal light usage. 45% fan keeps temps stable without noise.",
        "color": "teal"
    },
    {
        "temp_min": 65,  "temp_max": 75,
        "recommended_pct": 65,
        "label": "Medium Load",
        "reason": "Moderate thermal output. 65% fan provides comfortable headroom.",
        "color": "amber"
    },
    {
        "temp_min": 75,  "temp_max": 82,
        "recommended_pct": 80,
        "label": "Gaming Load",
        "reason": "Elevated temps from gaming. 80% fan prevents thermal escalation.",
        "color": "amber"
    },
    {
        "temp_min": 82,  "temp_max": 90,
        "recommended_pct": 95,
        "label": "High Thermal Stress",
        "reason": "Approaching warning threshold. Max cooling recommended immediately.",
        "color": "orange"
    },
    {
        "temp_min": 90,  "temp_max": 200,
        "recommended_pct": 100,
        "label": "CRITICAL — Max Cooling",
        "reason": "Above safe limits. 100% fan is mandatory. Close heavy apps now.",
        "color": "red"
    },
]


def get_fan_recommendation(cpu_temp: float, gpu_temp: float) -> Dict[str, Any]:
    """Return the recommended fan speed for the current temperature pair."""
    max_temp = max(cpu_temp, gpu_temp)
    for entry in FAN_RECOMMENDATION_TABLE:
        if entry["temp_min"] <= max_temp < entry["temp_max"]:
            return {
                "max_temp":         round(max_temp, 1),
                "recommended_pct":  entry["recommended_pct"],
                "label":            entry["label"],
                "reason":           entry["reason"],
                "color":            entry["color"],
            }
    # Fallback — should never happen
    return {
        "max_temp": round(max_temp, 1),
        "recommended_pct": 100,
        "label": "Unknown — Max Safe",
        "reason": "Temperature out of known range. Using max cooling as precaution.",
        "color": "red",
    }


class FanControlService:
    """
    Manages manual fan speed overrides and tracks history.
    Commands Windows thermal schemes and clamps to safe operating ranges.
    """

    def __init__(self, controller, safety_config: Dict[str, Any]):
        self.controller    = controller
        self.min_pct       = int(safety_config.get("min_safe_fan_pct", 0))
        self.max_pct       = int(safety_config.get("max_fan_pct", 100))
        self.fan_control_enabled = safety_config.get("fan_control_enabled", True)

        self._manual_override: Optional[int] = None   # None = auto
        self._override_timestamp: float      = 0.0
        self._history: List[Dict[str, Any]]  = []     # last 50 changes

    def enable_control(self, enabled: bool) -> None:
        self.fan_control_enabled = enabled

    def _find_dell_fan_bin(self) -> Optional[Path]:
        """Locates DellFanCmd.exe across common relative project paths."""
        candidates = [
            Path(__file__).parent.parent / "bin" / "DellFanCmd.exe",
            Path(__file__).parent.parent.parent / "bin" / "DellFanCmd.exe",
            Path(__file__).parent.parent / "bin" / "DellFanCmd-1.1" / "DellFanCmd.exe",
            Path(__file__).parent.parent.parent / "bin" / "DellFanCmd-1.1" / "DellFanCmd.exe",
        ]
        for c in candidates:
            if c.exists():
                return c
        which_path = shutil.which("DellFanCmd") or shutil.which("DellFanCmd.exe")
        return Path(which_path) if which_path else None

    def get_physical_rpm(self) -> Optional[int]:
        """Attempts to read the real hardware fan RPM from Dell SMM driver."""
        bin_path = self._find_dell_fan_bin()
        if not bin_path:
            return None
        try:
            res = subprocess.run([str(bin_path), "fan1-rpm"], cwd=str(bin_path.parent), capture_output=True, timeout=2)
            code = res.returncode
            if 100 < code < 8000:
                return int(code)
        except Exception:
            pass
        return None

    def set_fan_speed(self, pct: int, source: str = "manual") -> Dict[str, Any]:
        """Apply a fan speed override. Commands Dell SMM hardware controller."""
        clamped = max(self.min_pct, min(self.max_pct, int(pct)))
        applied = False
        message = ""

        bin_path = self._find_dell_fan_bin()
        if bin_path:
            cwd = str(bin_path.parent)
            try:
                # 1. Disable EC automatic control so manual speeds take effect
                r = subprocess.run([str(bin_path), "ec-disable"], cwd=cwd, capture_output=True, timeout=2)
                if r.returncode != 0:
                    subprocess.run([str(bin_path), "ec-disable-alt"], cwd=cwd, capture_output=True, timeout=2)

                # 2. Set fan levels (0 = off, 1 = 50%, 2 = 100%)
                level = "2" if clamped >= 75 else ("1" if clamped >= 35 else "0")
                subprocess.run([str(bin_path), f"fan1-level{level}"], cwd=cwd, capture_output=True, timeout=2)
                subprocess.run([str(bin_path), f"fan2-level{level}"], cwd=cwd, capture_output=True, timeout=2)
                applied = True
                message = f"Fan speed set to {clamped}% (Dell SMM Level {level}) via DellFanCmd."
            except Exception as e:
                message = f"Dell hardware controller notice: {e}"
        else:
            message = f"Fan speed set to {clamped}% in dashboard (Active target: {clamped}%)."
            applied = True

        if self.fan_control_enabled:
            try:
                self.controller.set_fan_speed("all", clamped)
                applied = True
                if not message:
                    message = f"Fan speed set to {clamped}%."
            except Exception as e:
                message = f"Hardware controller: {e}"

        self._manual_override      = clamped
        self._override_timestamp   = time.time()

        entry = {
            "timestamp":  self._override_timestamp,
            "pct":        clamped,
            "source":     source,
            "applied":    applied,
            "message":    message,
        }
        self._history.append(entry)
        if len(self._history) > 50:
            self._history.pop(0)

        return entry

    def set_auto(self) -> Dict[str, Any]:
        """Clear manual override and return to automatic BIOS fan control."""
        self._manual_override    = None
        self._override_timestamp = 0.0

        bin_path = self._find_dell_fan_bin()
        if bin_path:
            cwd = str(bin_path.parent)
            try:
                r = subprocess.run([str(bin_path), "ec-enable"], cwd=cwd, capture_output=True, timeout=2)
                if r.returncode != 0:
                    subprocess.run([str(bin_path), "ec-enable-alt"], cwd=cwd, capture_output=True, timeout=2)
            except Exception:
                pass

        return {"status": "auto", "message": "Fan control returned to automatic BIOS cooling."}

    def get_state(self) -> Dict[str, Any]:
        return {
            "manual_override":        self._manual_override,
            "override_active":        self._manual_override is not None,
            "override_timestamp":     self._override_timestamp,
            "fan_control_enabled":    self.fan_control_enabled,
            "min_pct":                self.min_pct,
            "max_pct":                self.max_pct,
        }

    def get_history(self) -> List[Dict[str, Any]]:
        return list(reversed(self._history[-20:]))

