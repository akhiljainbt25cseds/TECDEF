# Troubleshooting & FAQs

### 1. "Agent Offline" Banner Appears on Frontend
* Check if the agent is running: `python3 run_agent.py --mock`.
* Make sure port `8765` is not occupied by another service:
  ```bash
  netstat -ano | findstr 8765  # Windows
  lsof -i :8765                # macOS / Linux
  ```

### 2. Fan Speeds Report 0 RPM
* Download and run **LibreHardwareMonitor**.
* In LibreHardwareMonitor, navigate to **Options -> Remote Web Server -> Run**.
* The agent reads the local JSON feed at `http://localhost:8085/data.json`.

### 3. Permission Denied When Adjusting GPU Power
* Modifying NVIDIA power limits requires elevated command prompt on Windows (`Run as administrator`).
* If unprivileged, the agent automatically falls back to notification-only mode.
