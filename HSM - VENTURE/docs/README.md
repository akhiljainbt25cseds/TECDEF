# TechDef Pro: Real-Time Hardware Monitoring & Auto-Cooling Dashboard for Gamers

An intelligent, low-latency gaming hardware telemetry dashboard and automated thermal protection system. Built with **Flask 3.x** for the local system agent and a reactive **React 18 & Tailwind CSS** gamer dashboard.

---

## 🎮 Architecture

```
┌──────────────────────────────────────────────┐
│        Frontend Gamer Dashboard (React)      │
│  - Live 60-second rolling temperature charts │
│  - Active game session & throttle tracking   │
│  - Auto-cooling automation rules & profiles  │
│  - Reversible actions log with 1-click undo  │
└──────────────────────▲───────────────────────┘
                       │ WebSocket (ws://localhost:8765/metrics)
                       │ Flask REST API (http://localhost:8765/api/...)
                       │ Flask SSE Stream (http://localhost:8765/api/stream)
┌──────────────────────▼───────────────────────┐
│         Local Agent (Flask 3.x Backend)      │
│  - psutil & pynvml (CPU/GPU core metrics)    │
│  - LibreHardwareMonitor (Fan RPMs & temps)   │
│  - Smart Rules Engine with 30s Hysteresis    │
│  - Reversible hardware controller adapter    │
│  - SQLite session & action history           │
└──────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### 1. Start the Flask Hardware Agent

```bash
# Recommended: Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r agent/requirements.txt

# Run the Flask agent in mock mode (works on any machine)
python3 run_agent.py --mock

# Run the Flask agent with real sensors (Windows Administrator / Linux)
python3 run_agent.py
```

### 2. Open the Dashboard

You can access the dashboard in two ways:
* Directly through **Flask**: **`http://localhost:8765`** (Flask serves the static frontend and REST endpoints directly)
* Or through the static server / local file: **`http://localhost:8000`**

---

## 📡 Flask Endpoints & API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Serves the React 18 & Tailwind gamer dashboard |
| `/api/status` | `GET` | Service status, framework (Flask 3.x), mode, and active profile |
| `/api/metrics` | `GET` | Instantaneous hardware telemetry snapshot |
| `/api/history` | `GET` | 60-second rolling telemetry history |
| `/api/settings` | `GET/POST` | Read or update temperature thresholds and cooling profiles |
| `/api/actions` | `GET` | Audit log of all automated cooling adjustments |
| `/api/actions/undo` | `POST` | Revert a previous automated cooling adjustment by ID |
| `/api/sessions` | `GET` | Historical gaming sessions stored in SQLite |
| `/api/trends` | `GET` | 14-day aggregated gaming trends & thermal stats |
| `/api/rules` | `GET/POST` | List or deploy custom automation rules |
| `/api/rules/<id>` | `DELETE` | Delete custom automation rule by ID |
| `/api/stream` | `GET` | Flask Server-Sent Events (SSE) live streaming feed |
| `ws://localhost:8765/metrics` | `WS` | 1-second WebSocket telemetry broadcast |

---

## 🛡️ Smart Auto-Cooling Automation Engine

* **Step 1 (Warning Dwell)**: If CPU/GPU temp exceeds warning threshold (default **80°C**) for **5 seconds**, fan curves ramp up to 90%.
* **Step 2 (Load Reduction)**: If temperature remains high for **15 seconds**, the engine requests a GPU power limit reduction to 85% or an FPS cap.
* **Step 3 (Critical Safeguard)**: If hardware crosses **92°C**, aggressive thermal throttling and critical desktop alerts activate immediately.
* **Hysteresis Recovery**: When temperatures drop below the safe zone (**72°C**) continuously for **30 seconds**, previous cooling states restore gradually to prevent fan speed flapping.
* **Reversibility**: Every automatic adjustment is logged in SQLite with a 1-click **"Undo"** button in the dashboard.
