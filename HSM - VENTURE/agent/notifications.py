"""
TechDef Pro: Smart Overheat Notification & Diagnosis Engine
Detects WHY the laptop is overheating and tells the user exactly what to do.
Supports Native Windows Desktop Toasts + Topmost Gaming HUD Overlays.
"""
import time
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ALERT_SCRIPT = Path(__file__).parent / "desktop_alert.py"

def fire_external_desktop_notification(title: str, message: str, temp_c: float, game_name: str = "Active Game"):
    """Fires native Windows Toast notification and topmost gaming HUD overlay over the game."""
    try:
        subprocess.Popen(
            [sys.executable, str(ALERT_SCRIPT), str(title), str(message), f"{temp_c:.1f}", str(game_name)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception:
        pass



# ─── Diagnosis Rules ────────────────────────────────────────────────────────

def _diagnose_causes(snapshot: Dict[str, Any], thresholds: Dict[str, Any]) -> List[Dict[str, str]]:
    """Analyse the live snapshot and return a list of probable root causes."""
    causes = []

    cpu = snapshot.get("cpu", {})
    gpu = snapshot.get("gpu", {})
    ram = snapshot.get("ram", {})
    fans = snapshot.get("fans", [])
    gaming = snapshot.get("gaming", {})

    cpu_temp  = float(cpu.get("package_temp_c", 0))
    gpu_temp  = float(gpu.get("core_temp_c",    0))
    cpu_usage = float(cpu.get("usage_pct", 0))
    gpu_usage = float(gpu.get("usage_pct", 0))
    ram_pct   = float(ram.get("usage_pct", 0))

    cpu_warn = float(thresholds.get("cpu_warn_c", 80))
    gpu_warn = float(thresholds.get("gpu_warn_c", 80))

    # ── Fans spinning very slowly while temps are high ───────────────────────
    low_fan_rpms = [f for f in fans if f.get("rpm", 9999) < 800]
    if low_fan_rpms and (cpu_temp >= cpu_warn or gpu_temp >= gpu_warn):
        causes.append({
            "icon": "🌀",
            "title": "Fan(s) Not Spinning Properly",
            "detail": (
                f"{', '.join(f['name'] for f in low_fan_rpms)} "
                f"{'is' if len(low_fan_rpms)==1 else 'are'} running below 800 RPM "
                f"while temperatures are high ({cpu_temp:.0f}°C CPU / {gpu_temp:.0f}°C GPU). "
                "This is the most common cause of laptop overheating."
            ),
            "fix": "Go to the Fan Control tab and manually boost the fan speed to 80–100%. "
                   "If the fan cannot be controlled or RPM stays near 0, physical inspection is required — "
                   "dust blockage or a failing fan motor is likely."
        })

    # ── Both CPU and GPU spiked — heavy gaming or background miner ───────────
    if cpu_usage > 85 and gpu_usage > 85:
        causes.append({
            "icon": "🔥",
            "title": "Simultaneous CPU + GPU Overload",
            "detail": (
                f"CPU is at {cpu_usage:.0f}% and GPU is at {gpu_usage:.0f}% simultaneously. "
                "Gaming, video rendering, or a background crypto miner can cause this pattern."
            ),
            "fix": "Lower in-game graphics settings (resolution, ray-tracing, shadow quality). "
                   "Open Task Manager and look for unexpected processes consuming CPU or GPU. "
                   "Enable the Silent or Balanced profile in the Automation tab."
        })

    # ── Only CPU spiked, GPU fine — background process or game engine ────────
    elif cpu_usage > 90 and gpu_usage < 50:
        causes.append({
            "icon": "⚙️",
            "title": "CPU-Bound Process or Background Load",
            "detail": (
                f"CPU usage is at {cpu_usage:.0f}% but GPU is only at {gpu_usage:.0f}%. "
                "A CPU-heavy background process (antivirus scan, Windows Update, browser, "
                "or a game running on CPU-heavy settings) is the likely culprit."
            ),
            "fix": "Open Task Manager (Ctrl+Shift+Esc) → CPU column → end any unexpected high-CPU process. "
                   "Consider pausing Windows Updates or antivirus scans during gaming sessions."
        })

    # ── Very high RAM usage — memory pressure forces swap / disk I/O ─────────
    if ram_pct > 90:
        causes.append({
            "icon": "🧠",
            "title": "RAM Critically Full — Memory Pressure",
            "detail": (
                f"System RAM is {ram_pct:.0f}% full. Windows is likely using the pagefile (disk swap), "
                "which hammers the SSD and forces the CPU to work overtime, generating extra heat."
            ),
            "fix": "Close browser tabs, Discord, Spotify, or other background apps before gaming. "
                   "If this happens frequently, upgrading from " +
                   f"{ram.get('total_gb',0):.0f} GB RAM would help."
        })

    # ── Game detected + thermal spike ────────────────────────────────────────
    if gaming.get("game_running") and (cpu_temp >= cpu_warn or gpu_temp >= gpu_warn):
        causes.append({
            "icon": "🎮",
            "title": "Gaming Load Without Adequate Cooling",
            "detail": (
                f"'{gaming.get('active_game','Game')}' is running and your hardware temps are climbing "
                f"({cpu_temp:.0f}°C CPU / {gpu_temp:.0f}°C GPU). "
                "Gaming laptops often throttle when ambient temperature is high or airflow is restricted."
            ),
            "fix": "Make sure your laptop is on a hard flat surface, NOT on a bed or lap "
                   "(blocks intake vents). Use a laptop cooling pad. "
                   "Lower the in-game FPS cap and check if power mode is set to 'Balanced' in Windows."
        })

    # ── Generic: high temp but no other specific cause ───────────────────────
    if not causes:
        causes.append({
            "icon": "🌡️",
            "title": "General Thermal Buildup",
            "detail": (
                f"CPU: {cpu_temp:.0f}°C  GPU: {gpu_temp:.0f}°C. "
                "The system is running hotter than the safe zone. "
                "Possible causes include dust accumulation on heatsink/fans, "
                "aged thermal paste, or high ambient room temperature."
            ),
            "fix": "1) Blow compressed air into all laptop vents.  "
                   "2) If your laptop is 1–2+ years old, thermal paste replacement can drop temps by 15–25°C.  "
                   "3) Make sure the room is reasonably cool (< 30°C ambient).  "
                   "4) Use a cooling pad."
        })

    return causes


def _next_steps(level: str, cpu_temp: float, gpu_temp: float, fans: List) -> List[str]:
    """Return ordered actionable next steps based on severity."""
    if level == "critical":
        return [
            "IMMEDIATELY save your work — hardware may force-shutdown to protect itself.",
            "Close the game or heavy application RIGHT NOW.",
            "Go to Fan Control tab → set fans to 100% manually.",
            "Plug in power if on battery — thermal throttle is worse on battery.",
            "If temperatures do not drop in 60 seconds, shut down and let the laptop cool for 15+ minutes.",
            "After cooling, check that all laptop vents are unobstructed.",
        ]
    elif level == "warning":
        return [
            "Lower graphics settings in-game (resolution, shadows, ray tracing).",
            "Go to the Fan Control tab and boost fan speed to 80–90%.",
            "Switch the cooling profile to 'Performance' in the Automation tab.",
            "Ensure your laptop is on a hard surface with free airflow on all sides.",
            "Close non-essential background apps (browser, Discord, Spotify).",
            "If this warning persists, the laptop may need its heatsink cleaned.",
        ]
    else:
        return [
            "Monitor temps over the next few minutes.",
            "Boost fan speed slightly in the Fan Control tab as a precaution.",
        ]


class NotificationEngine:
    """
    Tracks thermal history and fires smart overheat notifications with
    root-cause diagnosis and step-by-step next-action guidance.
    """

    def __init__(self, thresholds: Dict[str, Any]):
        self.thresholds = thresholds
        self._last_critical_fire: float = 0
        self._last_warning_fire:  float = 0
        self._warning_cooldown  = 45   # seconds between warning toasts
        self._critical_cooldown = 20   # seconds between critical toasts

    def update_thresholds(self, thresholds: Dict[str, Any]) -> None:
        self.thresholds.update(thresholds)

    def evaluate(self, snapshot: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Call once per metrics tick. Returns a notification dict if a threshold
        is crossed and the cooldown has expired; otherwise returns None.
        """
        now = time.time()

        cpu_temp = float(snapshot.get("cpu", {}).get("package_temp_c", 0))
        gpu_temp = float(snapshot.get("gpu", {}).get("core_temp_c",    0))
        fans     = snapshot.get("fans", [])

        cpu_crit = float(self.thresholds.get("cpu_crit_c", 92))
        gpu_crit = float(self.thresholds.get("gpu_crit_c", 90))
        cpu_warn = float(self.thresholds.get("cpu_warn_c", 80))
        gpu_warn = float(self.thresholds.get("gpu_warn_c", 80))

        # ── CRITICAL ─────────────────────────────────────────────────────────
        if (cpu_temp >= cpu_crit or gpu_temp >= gpu_crit):
            if now - self._last_critical_fire >= self._critical_cooldown:
                self._last_critical_fire = now
                causes = _diagnose_causes(snapshot, self.thresholds)
                steps  = _next_steps("critical", cpu_temp, gpu_temp, fans)
                game_name = snapshot.get("gaming", {}).get("active_game") or "FivePlay Online Game"
                fire_external_desktop_notification(
                    title="CRITICAL HARDWARE OVERHEAT",
                    message="CPU die junction exceeded safe thermal ceiling! Autonomous cooling engaged fans to 100%.",
                    temp_c=max(cpu_temp, gpu_temp),
                    game_name=game_name
                )
                return {
                    "id":        f"notif_{int(now)}",
                    "level":     "critical",
                    "title":     f"CRITICAL OVERHEAT — {max(cpu_temp, gpu_temp):.0f}°C",
                    "summary":   (
                        f"CPU: {cpu_temp:.0f}°C  |  GPU: {gpu_temp:.0f}°C\n"
                        "Hardware is above safe operating limits. Immediate action required."
                    ),
                    "causes":    causes,
                    "next_steps": steps,
                    "timestamp": now,
                    "cpu_temp":  cpu_temp,
                    "gpu_temp":  gpu_temp,
                    "auto_dismissed_after": 0,   # never auto-dismiss critical
                }

        # ── WARNING ───────────────────────────────────────────────────────────
        if (cpu_temp >= cpu_warn or gpu_temp >= gpu_warn):
            if now - self._last_warning_fire >= self._warning_cooldown:
                self._last_warning_fire = now
                causes = _diagnose_causes(snapshot, self.thresholds)
                steps  = _next_steps("warning", cpu_temp, gpu_temp, fans)
                game_name = snapshot.get("gaming", {}).get("active_game") or "FivePlay Online Game"
                fire_external_desktop_notification(
                    title="THERMAL LOAD WARNING",
                    message="Hardware temperature approaching thermal threshold under gaming load.",
                    temp_c=max(cpu_temp, gpu_temp),
                    game_name=game_name
                )
                return {
                    "id":        f"notif_{int(now)}",
                    "level":     "warning",
                    "title":     f"Thermal Warning — {max(cpu_temp, gpu_temp):.0f}°C",
                    "summary":   (
                        f"CPU: {cpu_temp:.0f}°C  |  GPU: {gpu_temp:.0f}°C\n"
                        f"Approaching thermal limits (CPU warn: {cpu_warn}°C / GPU warn: {gpu_warn}°C)."
                    ),
                    "causes":    causes,
                    "next_steps": steps,
                    "timestamp": now,
                    "cpu_temp":  cpu_temp,
                    "gpu_temp":  gpu_temp,
                    "auto_dismissed_after": 30,
                }

        return None

