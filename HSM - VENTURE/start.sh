#!/bin/bash
# TechDef Pro All-in-One Startup Script
cd "$(dirname "$0")"
python3 server.py "$@"
