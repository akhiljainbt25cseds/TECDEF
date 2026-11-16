"""
Rule Definitions and Condition Evaluators for Smart Automation Engine
"""
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

@dataclass
class AutomationRule:
    id: str
    name: str
    metric_path: str        # e.g. "cpu.package_temp_c" or "gpu.core_temp_c"
    operator: str           # ">", ">=", "<", "<=", "=="
    threshold_value: float
    duration_seconds: float # Must satisfy condition continuously for this duration
    action_type: str        # "increase_fans" | "lower_power_limit" | "fps_cap" | "critical_throttle" | "notify"
    target_value: Optional[Any] = None
    enabled: bool = True

def evaluate_operator(actual: float, op: str, target: float) -> bool:
    if op == ">": return actual > target
    if op == ">=": return actual >= target
    if op == "<": return actual < target
    if op == "<=": return actual <= target
    if op == "==": return abs(actual - target) < 0.01
    return False

def get_nested_metric(data: Dict[str, Any], path: str) -> Optional[float]:
    parts = path.split(".")
    curr = data
    for p in parts:
        if isinstance(curr, dict) and p in curr:
            curr = curr[p]
        else:
            return None
    try:
        return float(curr)
    except (ValueError, TypeError):
        return None
