"""
Automation Rules Engine with Multi-Step Escalation & 30s Hysteresis Recovery
"""
import time
from typing import Any, Dict, List, Optional
from .rules import AutomationRule, evaluate_operator, get_nested_metric
from .actions import ActionDispatcher

class AutomationEngine:
    def __init__(self, dispatcher: ActionDispatcher, config: Dict[str, Any]):
        self.dispatcher = dispatcher
        self.config = config
        self.thresholds = config.get("thresholds", {})
        self.safety = config.get("safety", {})
        
        self.active_profile = config.get("active_profile", "auto")
        self.custom_rules: List[AutomationRule] = []

        # Escalation & Dwell Time Tracking
        self.warn_dwell_target = float(self.safety.get("warning_dwell_seconds", 5))
        self.hysteresis_dwell_target = float(self.safety.get("hysteresis_seconds", 30))

        self.cpu_warn_start: Optional[float] = None
        self.gpu_warn_start: Optional[float] = None
        self.recovery_start: Optional[float] = None

        self.current_escalation_step = 0 # 0=Normal, 1=Fans Boosted, 2=Power Reduced, 3=Critical Throttled
        self.active_alerts: List[Dict[str, Any]] = []

    def set_profile(self, profile_name: str) -> bool:
        if profile_name in ("silent", "balanced", "performance", "auto"):
            self.active_profile = profile_name
            return True
        return False

    def add_custom_rule(self, rule: AutomationRule) -> None:
        self.custom_rules.append(rule)

    def get_custom_rules(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": r.id,
                "name": r.name,
                "metric_path": r.metric_path,
                "operator": r.operator,
                "threshold_value": r.threshold_value,
                "duration_seconds": r.duration_seconds,
                "action_type": r.action_type,
                "target_value": r.target_value,
                "enabled": r.enabled,
            }
            for r in self.custom_rules
        ]

    def delete_custom_rule(self, rule_id: str) -> bool:
        initial_len = len(self.custom_rules)
        self.custom_rules = [r for r in self.custom_rules if r.id != rule_id]
        return len(self.custom_rules) < initial_len

    def evaluate(self, snapshot: Dict[str, Any]) -> List[Dict[str, Any]]:
        now = time.time()
        actions_fired: List[Dict[str, Any]] = []
        self.active_alerts.clear()

        cpu_temp = float(snapshot.get("cpu", {}).get("package_temp_c", 0.0))
        gpu_temp = float(snapshot.get("gpu", {}).get("core_temp_c", 0.0))
        max_temp = max(cpu_temp, gpu_temp)

        cpu_warn = float(self.thresholds.get("cpu_warn_c", 80.0))
        cpu_crit = float(self.thresholds.get("cpu_crit_c", 92.0))
        cpu_safe = float(self.thresholds.get("cpu_safe_c", 72.0))

        gpu_warn = float(self.thresholds.get("gpu_warn_c", 80.0))
        gpu_crit = float(self.thresholds.get("gpu_crit_c", 90.0))
        gpu_safe = float(self.thresholds.get("gpu_safe_c", 70.0))

        # Check Active Game Profile Override
        if self.active_profile == "auto":
            gaming = snapshot.get("gaming", {})
            if gaming.get("game_running"):
                target_fan = self.config.get("profiles", {}).get("performance", {}).get("fan_target_pct", 90)
            else:
                target_fan = self.config.get("profiles", {}).get("balanced", {}).get("fan_target_pct", 65)
            self.dispatcher.baseline_fan_pct = target_fan

        # -------------------------------------------------------------
        # STEP 3: CRITICAL OVER-TEMPERATURE CHECK
        # -------------------------------------------------------------
        if cpu_temp >= cpu_crit or gpu_temp >= gpu_crit:
            if self.current_escalation_step < 3:
                self.current_escalation_step = 3
                act = self.dispatcher.dispatch(
                    rule_id="thermal_crit_step3",
                    trigger_metric="cpu/gpu_temp",
                    trigger_val=max_temp,
                    action_type="critical_throttle",
                    target_val=None
                )
                actions_fired.append(act)

            self.active_alerts.append({
                "level": "critical",
                "title": "CRITICAL THERMAL THROTTLING ACTIVE",
                "message": f"Hardware temp at {max_temp:.1f}°C exceeded critical safety threshold!",
                "timestamp": now
            })
            self.recovery_start = None
            return actions_fired

        # -------------------------------------------------------------
        # STEP 1 & 2: WARNING DWELL TIME EVALUATION (> 80°C for 5 seconds)
        # -------------------------------------------------------------
        is_warning = (cpu_temp >= cpu_warn) or (gpu_temp >= gpu_warn)

        if is_warning:
            if self.cpu_warn_start is None:
                self.cpu_warn_start = now
            dwell = now - self.cpu_warn_start

            self.active_alerts.append({
                "level": "warning",
                "title": f"Hardware Running Warm ({max_temp:.1f}°C)",
                "message": f"Over warning threshold ({cpu_warn}°C) for {int(dwell)}s",
                "timestamp": now
            })

            # Step 1: Dwell >= 5 seconds -> Increase Fans
            if dwell >= self.warn_dwell_target and self.current_escalation_step == 0:
                self.current_escalation_step = 1
                act = self.dispatcher.dispatch(
                    rule_id="thermal_warn_step1",
                    trigger_metric="temp_warning",
                    trigger_val=max_temp,
                    action_type="increase_fans",
                    target_val=95
                )
                actions_fired.append(act)

            # Step 2: Dwell >= 15 seconds still rising -> Lower power limit & suggest FPS cap
            elif dwell >= (self.warn_dwell_target + 10.0) and self.current_escalation_step == 1:
                self.current_escalation_step = 2
                act = self.dispatcher.dispatch(
                    rule_id="thermal_warn_step2",
                    trigger_metric="temp_sustained",
                    trigger_val=max_temp,
                    action_type="lower_power_limit",
                    target_val=85
                )
                actions_fired.append(act)

            self.recovery_start = None
        else:
            self.cpu_warn_start = None

            # -------------------------------------------------------------
            # HYSTERESIS RECOVERY: Safe temp (< 72°C) sustained for 30s
            # -------------------------------------------------------------
            is_safe = (cpu_temp < cpu_safe) and (gpu_temp < gpu_safe)
            if is_safe and self.current_escalation_step > 0:
                if self.recovery_start is None:
                    self.recovery_start = now
                recovery_dwell = now - self.recovery_start

                if recovery_dwell >= self.hysteresis_dwell_target:
                    act = self.dispatcher.dispatch(
                        rule_id="hysteresis_recovery",
                        trigger_metric="safe_temp",
                        trigger_val=max_temp,
                        action_type="restore_safe",
                        target_val=None
                    )
                    actions_fired.append(act)
                    self.current_escalation_step = 0
                    self.recovery_start = None

        # Evaluate Any User Custom Rules
        for rule in self.custom_rules:
            if not rule.enabled:
                continue
            val = get_nested_metric(snapshot, rule.metric_path)
            if val is not None and evaluate_operator(val, rule.operator, rule.threshold_value):
                act = self.dispatcher.dispatch(
                    rule_id=rule.id,
                    trigger_metric=rule.metric_path,
                    trigger_val=val,
                    action_type=rule.action_type,
                    target_val=rule.target_value
                )
                actions_fired.append(act)

        return actions_fired
