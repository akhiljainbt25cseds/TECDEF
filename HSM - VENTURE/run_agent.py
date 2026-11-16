#!/usr/bin/env python3
"""
Convenience launcher for the TechDef Hardware Agent
Usage:
    python3 run_agent.py --mock
    python3 run_agent.py --port 8765
"""
import sys
import os

# Add workspace directory to python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent.main import main

if __name__ == "__main__":
    main()
