#!/usr/bin/env python3
"""
TechDef Pro - Root Launcher for Render & Cloud Hosting
Delegates execution to HSM - VENTURE/server.py
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.join(BASE_DIR, "HSM - VENTURE")

if os.path.exists(PROJECT_DIR):
    os.chdir(PROJECT_DIR)
    sys.path.insert(0, PROJECT_DIR)
    import server
    server.main()
else:
    sys.stderr.write(f"Error: Project directory not found at {PROJECT_DIR}\n")
    sys.exit(1)
