"""
Action Dispatcher with Safety Clamping & Reversibility Logging
"""
from typing import Any, Dict, Optional
from ..storage.repository import HistoryRepository
from .controllers.base import BaseHardwareController

class ActionDispatcher:
    def __init__(self, controller: BaseHardwareController, repository: HistoryRepository, safety_config: Dict[str, Any]):
        self.controller = controller
        self.repository = repository
        self.safety_config = safety_config
        self.min_safe_fan = safety_config.get("min_safe_fan_pct", 0)
        self.max_fan = safety_config.get("max_fan_pct", 100)
        self.fan_control_enabled = safety_config.get("fan_control_enabled", True)

        # Baseline states for reversion
        self.baseline_fan_pct = 60
        self.baseline_power_pct = 100
        self.active_overrides: Dict[str, Any] = {}

    def set_fan_control_enabled(self, enabled: bool) -> None:
        self.fan_control_enabled = enabled

    def dispatch(self, rule_id: str, trigger_metric: str, trigger_val: float, action_type: str, target_val: Any) -> Dict[str, Any]:
        result = {
            "rule_id": rule_id,
            "action_type": action_type,
            "applied": False,
            "message": "",
            "log_id": None
        }

        if action_type == "increase_fans":
            target_pct = int(target_val or 90)
            clamped = max(self.min_safe_fan, min(self.max_fan, target_pct))
            
            if self.fan_control_enabled:
                self.controller.set_fan_speed("all", clamped)
                result["applied"] = True
                result["message"] = f"Increased fan curves to {clamped}% RPM"
            else:
                result["applied"] = False
                result["message"] = f"Fan ramp to {clamped}% suggested (Hardware control opt-in required)"

            log_id = self.repository.log_action(
                rule_id=rule_id,
                trigger_metric=trigger_metric,
                trigger_val=trigger_val,
                action_type="fan_speed",
                component="cooling_fans",
                old_val=str(self.baseline_fan_pct),
                new_val=str(clamped)
            )
            result["log_id"] = log_id
            self.active_overrides["fan_speed"] = {"log_id": log_id, "val": clamped}

        elif action_type == "lower_power_limit":
            target_power = int(target_val or 85)
            clamped_power = max(60, min(100, target_power))
            
            if self.fan_control_enabled:
                self.controller.set_power_limit("gpu", clamped_power)
                result["applied"] = True
                result["message"] = f"Reduced GPU Power Limit to {clamped_power}%"
            else:
                result["applied"] = False
                result["message"] = f"Power throttle to {clamped_power}% suggested (Safety opt-in disabled)"

            log_id = self.repository.log_action(
                rule_id=rule_id,
                trigger_metric=trigger_metric,
                trigger_val=trigger_val,
                action_type="power_limit",
                component="gpu",
                old_val=str(self.baseline_power_pct),
                new_val=str(clamped_power)
            )
            result["log_id"] = log_id
            self.active_overrides["power_limit"] = {"log_id": log_id, "val": clamped_power}

        elif action_type == "critical_throttle":
            result["applied"] = True
            result["message"] = f"CRITICAL THERMAL ALERT: Hardware reached {trigger_val}°C! Aggressive cooling & FPS limit applied!"
            log_id = self.repository.log_action(
                rule_id=rule_id,
                trigger_metric=trigger_metric,
                trigger_val=trigger_val,
                action_type="critical_throttle",
                component="all",
                old_val="normal",
                new_val="throttled_safe"
            )
            result["log_id"] = log_id

        elif action_type == "restore_safe":
            if self.fan_control_enabled:
                self.controller.set_fan_speed("all", self.baseline_fan_pct)
                self.controller.set_power_limit("gpu", self.baseline_power_pct)
            result["applied"] = True
            result["message"] = f"Hysteresis recovery complete: Restored default cooling profile ({self.baseline_fan_pct}% fans)"
            log_id = self.repository.log_action(
                rule_id="hysteresis_recovery",
                trigger_metric=trigger_metric,
                trigger_val=trigger_val,
                action_type="restore_safe",
                component="cooling_system",
                old_val="boosted",
                new_val=str(self.baseline_fan_pct)
            )
            result["log_id"] = log_id
            self.active_overrides.clear()

        return result

    def undo_action(self, action_id: int) -> bool:
        """Manual undo/override from the frontend actions log."""
        self.controller.set_fan_speed("all", self.baseline_fan_pct)
        self.controller.set_power_limit("gpu", self.baseline_power_pct)
        return self.repository.mark_action_reverted(action_id)
