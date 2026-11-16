"""
Unit Tests for Hardware Sensor Collection & Mock Mode
"""
import unittest
from agent.sensors import SensorManager

class TestSensors(unittest.TestCase):
    def test_mock_sensor_snapshot_structure(self):
        mgr = SensorManager(mock_mode=True)
        snapshot = mgr.get_snapshot()

        self.assertIn("cpu", snapshot)
        self.assertIn("gpu", snapshot)
        self.assertIn("ram", snapshot)
        self.assertIn("disk", snapshot)
        self.assertIn("network", snapshot)
        self.assertIn("fans", snapshot)
        self.assertIn("gaming", snapshot)

        # Check CPU telemetry
        self.assertGreater(snapshot["cpu"]["package_temp_c"], 30.0)
        self.assertGreater(snapshot["cpu"]["usage_pct"], 0.0)
        self.assertGreaterEqual(len(snapshot["cpu"]["per_core_usage"]), 4)

        # Check GPU telemetry
        self.assertGreater(snapshot["gpu"]["core_temp_c"], 30.0)
        self.assertGreater(snapshot["gpu"]["vram_total_mb"], 4096)

        # Check Fans
        self.assertGreaterEqual(len(snapshot["fans"]), 1)
        self.assertGreaterEqual(snapshot["fans"][0]["rpm"], 0)

        # Check History Ring Buffer
        history = mgr.get_history()
        self.assertEqual(len(history), 1)

    def test_game_detector_idle_when_no_game(self):
        from agent.sensors.games import GameProcessDetector
        detector = GameProcessDetector(monitored_games=["fake_game_xyz_123.exe"])
        result = detector.collect()
        self.assertFalse(result["game_running"])
        self.assertIsNone(result["active_game"])
        self.assertIsNone(result["fps"])
        self.assertIsNone(result["frametime_ms"])

if __name__ == "__main__":
    unittest.main()
