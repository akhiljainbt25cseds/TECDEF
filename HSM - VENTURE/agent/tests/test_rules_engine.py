"""
Unit Tests for Smart Automation Engine & Safe Escalation / Hysteresis
"""
import unittest
import time
from pathlib import Path
import tempfile

from agent.storage.db import init_db
from agent.storage.repository import HistoryRepository
from agent.automation.controllers.fallback import SafeFallbackController
from agent.automation.actions import ActionDispatcher
from agent.automation.engine import AutomationEngine

class TestRulesEngine(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test.db"
        init_db(self.db_path)
        self.repo = HistoryRepository(db_path=self.db_path)
        self.controller = SafeFallbackController()
        
        self.config = {
            "thresholds": {
                "cpu_warn_c": 80.0,
                "cpu_crit_c": 92.0,
                "cpu_safe_c": 72.0,
                "gpu_warn_c": 80.0,
                "gpu_crit_c": 90.0,
                "gpu_safe_c": 70.0
            },
            "safety": {
                "fan_control_enabled": True,
                "min_safe_fan_pct": 40,
                "max_fan_pct": 100,
                "hysteresis_seconds": 30,
                "warning_dwell_seconds": 5
            },
            "active_profile": "balanced"
        }

        self.dispatcher = ActionDispatcher(self.controller, self.repo, self.config["safety"])
        self.engine = AutomationEngine(self.dispatcher, self.config)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_normal_operating_temperatures(self):
        """Under normal temps, no actions or warnings should fire."""
        snapshot = {
            "cpu": {"package_temp_c": 65.0},
            "gpu": {"core_temp_c": 62.0},
            "gaming": {"game_running": False}
        }
        actions = self.engine.evaluate(snapshot)
        self.assertEqual(len(actions), 0)
        self.assertEqual(self.engine.current_escalation_step, 0)
        self.assertEqual(len(self.engine.active_alerts), 0)

    def test_warning_escalation_step_1_fans(self):
        """When temp exceeds 80C for 5s, step 1 (fan speed boost) must trigger."""
        snapshot = {
            "cpu": {"package_temp_c": 83.0},
            "gpu": {"core_temp_c": 75.0},
            "gaming": {"game_running": True}
        }

        # First evaluation (dwell starts)
        self.engine.evaluate(snapshot)
        self.assertEqual(self.engine.current_escalation_step, 0)
        self.assertEqual(len(self.engine.active_alerts), 1)

        # Simulate 6 seconds dwell time passing
        self.engine.cpu_warn_start = time.time() - 6.0
        actions = self.engine.evaluate(snapshot)

        self.assertEqual(self.engine.current_escalation_step, 1)
        self.assertTrue(any(a["action_type"] == "increase_fans" for a in actions))

    def test_warning_escalation_step_2_power_reduction(self):
        """When temp remains high for 15s+, step 2 (power limit reduction) triggers."""
        snapshot = {
            "cpu": {"package_temp_c": 84.0},
            "gpu": {"core_temp_c": 82.0},
            "gaming": {"game_running": True}
        }
        self.engine.current_escalation_step = 1
        self.engine.cpu_warn_start = time.time() - 16.0

        actions = self.engine.evaluate(snapshot)
        self.assertEqual(self.engine.current_escalation_step, 2)
        self.assertTrue(any(a["action_type"] == "lower_power_limit" for a in actions))

    def test_critical_threshold_step_3(self):
        """When temp hits 92C, step 3 (critical throttle) fires immediately without waiting."""
        snapshot = {
            "cpu": {"package_temp_c": 94.0},
            "gpu": {"core_temp_c": 80.0},
            "gaming": {"game_running": True}
        }
        actions = self.engine.evaluate(snapshot)
        self.assertEqual(self.engine.current_escalation_step, 3)
        self.assertTrue(any(a["action_type"] == "critical_throttle" for a in actions))
        self.assertTrue(any(alert["level"] == "critical" for alert in self.engine.active_alerts))

    def test_hysteresis_recovery(self):
        """When temp drops below safe threshold (72C) for 30s, baseline settings recover."""
        self.engine.current_escalation_step = 1
        cool_snapshot = {
            "cpu": {"package_temp_c": 64.0},
            "gpu": {"core_temp_c": 60.0},
            "gaming": {"game_running": False}
        }

        # Starts recovery dwell
        self.engine.evaluate(cool_snapshot)
        self.assertIsNotNone(self.engine.recovery_start)

        # Advance dwell past 30 seconds
        self.engine.recovery_start = time.time() - 31.0
        actions = self.engine.evaluate(cool_snapshot)

        self.assertEqual(self.engine.current_escalation_step, 0)
        self.assertTrue(any(a["action_type"] == "restore_safe" for a in actions))

    def test_safety_bounds_clamping(self):
        """Fans must never be set below min_safe_fan (40%)."""
        act = self.dispatcher.dispatch(
            rule_id="test_clamp",
            trigger_metric="manual",
            trigger_val=50.0,
            action_type="increase_fans",
            target_val=15 # Intentionally unsafe low value
        )
        self.assertEqual(self.controller.last_attempted_fan.get("all"), 40)

    def test_undo_action_restores_defaults(self):
        """Action undo reverts the fan settings and marks log as reverted."""
        act = self.dispatcher.dispatch("rule_1", "cpu_temp", 85.0, "increase_fans", 90)
        log_id = act["log_id"]
        self.assertIsNotNone(log_id)

        undone = self.dispatcher.undo_action(log_id)
        self.assertTrue(undone)

        logs = self.repo.get_action_logs()
        target_log = next((l for l in logs if l["id"] == log_id), None)
        self.assertIsNotNone(target_log)
        self.assertEqual(target_log["is_reverted"], 1)

    def test_custom_rules_management(self):
        """User-defined rules should be registered, evaluated, listed, and deleted."""
        from agent.automation.rules import AutomationRule
        rule = AutomationRule(
            id="custom_ram_rule",
            name="Ramp fans on high RAM",
            metric_path="ram.usage_pct",
            operator=">",
            threshold_value=85.0,
            duration_seconds=5.0,
            action_type="set_fan_speed",
            target_value=95
        )
        self.engine.add_custom_rule(rule)
        rules = self.engine.get_custom_rules()
        self.assertEqual(len(rules), 1)
        self.assertEqual(rules[0]["id"], "custom_ram_rule")

        # Evaluate rule matching
        snapshot = {
            "cpu": {"package_temp_c": 60.0},
            "gpu": {"core_temp_c": 55.0},
            "ram": {"usage_pct": 92.0},
            "gaming": {"game_running": False}
        }
        fired = self.engine.evaluate(snapshot)
        self.assertTrue(any(a["rule_id"] == "custom_ram_rule" for a in fired))

        # Delete rule
        deleted = self.engine.delete_custom_rule("custom_ram_rule")
        self.assertTrue(deleted)
        self.assertEqual(len(self.engine.get_custom_rules()), 0)

    def test_session_trends(self):
        """Repository must aggregate sessions into trends summary and daily trends."""
        trends = self.repo.get_session_trends()
        self.assertIn("total_sessions", trends)
        self.assertIn("total_gaming_hours", trends)
        self.assertIn("daily_trends", trends)
        self.assertGreater(trends["total_sessions"], 0)

if __name__ == "__main__":
    unittest.main()
