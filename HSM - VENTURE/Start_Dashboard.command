#!/bin/bash
cd "$(dirname "$0")"

echo "=========================================================="
echo "  ⚡ TECHDEF PRO: REAL-TIME HARDWARE MONITOR & COOLING"
echo "  Apple Silicon MacBook Dashboard Launcher"
echo "=========================================================="
echo ""
echo "[*] Clearing any previous instances on port 8765..."
lsof -ti :8765 | xargs kill -9 2>/dev/null
sleep 0.5

echo "[*] Launching server on http://localhost:8765 ..."
echo "[*] Opening your default browser..."
echo ""

python3 server.py
