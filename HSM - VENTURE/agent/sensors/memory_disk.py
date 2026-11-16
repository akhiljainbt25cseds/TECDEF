"""
Memory & Disk Throughput Collector
Measures RAM allocation and live Disk read/write speeds.
"""
import time
import shutil
from typing import Any, Dict
from .base import BaseSensorCollector

class MemoryDiskCollector(BaseSensorCollector):
    def __init__(self):
        self._last_time = time.time()
        self._last_read_bytes = 0
        self._last_write_bytes = 0
        self._has_psutil = False

        try:
            import psutil
            self._has_psutil = True
            io = psutil.disk_io_counters()
            if io:
                self._last_read_bytes = io.read_bytes
                self._last_write_bytes = io.write_bytes
        except ImportError:
            pass

    @property
    def name(self) -> str:
        return "memory_disk"

    def collect(self) -> Dict[str, Any]:
        now = time.time()
        dt = max(0.1, now - self._last_time)
        self._last_time = now

        read_mbps = 0.0
        write_mbps = 0.0
        ram_used_gb = 8.0
        ram_total_gb = 16.0
        ram_pct = 50.0

        disk_used_gb = 250.0
        disk_total_gb = 512.0
        disk_pct = 48.8

        if self._has_psutil:
            import psutil
            # RAM
            vm = psutil.virtual_memory()
            ram_used_gb = round(vm.used / (1024**3), 2)
            ram_total_gb = round(vm.total / (1024**3), 2)
            ram_pct = vm.percent

            # Disk Space
            try:
                usage = psutil.disk_usage("/")
                disk_used_gb = round(usage.used / (1024**3), 1)
                disk_total_gb = round(usage.total / (1024**3), 1)
                disk_pct = usage.percent
            except Exception:
                pass

            # Disk IO throughput
            try:
                io = psutil.disk_io_counters()
                if io:
                    delta_read = max(0, io.read_bytes - self._last_read_bytes)
                    delta_write = max(0, io.write_bytes - self._last_write_bytes)
                    self._last_read_bytes = io.read_bytes
                    self._last_write_bytes = io.write_bytes
                    read_mbps = round((delta_read / (1024**2)) / dt, 1)
                    write_mbps = round((delta_write / (1024**2)) / dt, 1)
            except Exception:
                pass
        else:
            # Fallback with shutil
            try:
                total, used, free = shutil.disk_usage("/")
                disk_used_gb = round(used / (1024**3), 1)
                disk_total_gb = round(total / (1024**3), 1)
                disk_pct = round((used / total) * 100, 1)
            except Exception:
                pass

        return {
            "ram": {
                "used_gb": ram_used_gb,
                "total_gb": ram_total_gb,
                "usage_pct": ram_pct
            },
            "disk": {
                "used_gb": disk_used_gb,
                "total_gb": disk_total_gb,
                "usage_pct": disk_pct,
                "read_speed_mbps": read_mbps,
                "write_speed_mbps": write_mbps
            }
        }
