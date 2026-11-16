#!/usr/bin/env python3
"""
TechDef Pro: One-Command All-in-One Server Launcher
Runs the Flask backend agent and automatically launches the dashboard in your default browser.
Supports both real Apple Silicon hardware sensors and simulated mock gaming loads.
"""
import os
import sys
import time
import asyncio
import threading
import subprocess
import webbrowser
import argparse

# Ensure UTF-8 output on Windows consoles 
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Ensure current directory is in sys.path
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
if WORKSPACE_DIR not in sys.path:
    sys.path.insert(0, WORKSPACE_DIR)

from agent.main import AgentService

def auto_free_port(port: int = 8765):
    """Automatically terminates any lingering previous process holding port 8765."""
    try:
        if sys.platform == "win32":
            res = subprocess.run(
                f'netstat -ano | findstr :{port}',
                shell=True, capture_output=True, text=True
            )
            current_pid = str(os.getpid())
            for line in res.stdout.strip().splitlines():
                parts = line.strip().split()
                if len(parts) >= 5 and "LISTENING" in parts:
                    pid = parts[-1]
                    if pid != current_pid and pid.isdigit() and int(pid) > 0:
                        try:
                            subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
                        except Exception:
                            pass
            time.sleep(0.4)
        else:
            res = subprocess.run(["lsof", "-ti", f":{port}"], capture_output=True, text=True)
            if res.returncode == 0 and res.stdout.strip():
                pids = res.stdout.strip().split()
                current_pid = str(os.getpid())
                for pid in pids:
                    if pid != current_pid:
                        try:
                            os.kill(int(pid), 9)
                        except ProcessLookupError:
                            pass
                time.sleep(0.4)
    except Exception:
        pass

def open_browser(url: str, delay: float = 0.8):
    """Opens default browser after a brief delay so the server starts listening."""
    def _target():
        time.sleep(delay)
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            print(f"\n[Browser] Opening TechDef in your default browser: {url}")
        except Exception:
            pass

    t = threading.Thread(target=_target, daemon=True)
    t.start()

def main():
    parser = argparse.ArgumentParser(description="TechDef Pro: All-in-One Server Launcher")
    parser.add_argument("--mock", "-m", action="store_true", help="Run with simulated heavy gaming load")
    default_port = int(os.environ.get("PORT", 8765))
    parser.add_argument("--port", "-p", type=int, default=default_port, help=f"Port to listen on (default {default_port})")
    default_no_browser = bool(os.environ.get("RENDER") or os.environ.get("PORT"))
    parser.add_argument("--no-browser", action="store_true", default=default_no_browser, help="Do not automatically launch browser")
    args = parser.parse_args()

    port = args.port
    url = f"http://localhost:{port}"

    # 1. Clear any stuck port conflict automatically (local Windows only)
    if sys.platform == "win32" and not os.environ.get("RENDER"):
        auto_free_port(port)

    # 2. Auto-launch default browser (local desktop only)
    if not args.no_browser and not os.environ.get("RENDER") and not os.environ.get("PORT"):
        open_browser(url)

    # 3. Start Flask + WebSocket Agent
    agent = AgentService(mock_mode=args.mock, port=port)
    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        print("\n[Stopped] Server shut down gracefully.")
        sys.exit(0)

if __name__ == "__main__":
    main()
