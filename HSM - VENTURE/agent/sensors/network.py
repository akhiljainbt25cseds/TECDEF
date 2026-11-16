"""
Network Bandwidth & Latency Collector
"""
import time
import socket
from typing import Any, Dict
from .base import BaseSensorCollector

class NetworkCollector(BaseSensorCollector):
    def __init__(self):
        self._last_time = time.time()
        self._last_sent = 0
        self._last_recv = 0
        self._has_psutil = False

        try:
            import psutil
            self._has_psutil = True
            net = psutil.net_io_counters()
            if net:
                self._last_sent = net.bytes_sent
                self._last_recv = net.bytes_recv
        except ImportError:
            pass

    @property
    def name(self) -> str:
        return "network"

    def collect(self) -> Dict[str, Any]:
        now = time.time()
        dt = max(0.1, now - self._last_time)
        self._last_time = now

        down_mbps = 0.0
        up_mbps = 0.0

        if self._has_psutil:
            import psutil
            try:
                net = psutil.net_io_counters()
                if net:
                    delta_sent = max(0, net.bytes_sent - self._last_sent)
                    delta_recv = max(0, net.bytes_recv - self._last_recv)
                    self._last_sent = net.bytes_sent
                    self._last_recv = net.bytes_recv
                    down_mbps = round(((delta_recv * 8) / (1024**2)) / dt, 1)
                    up_mbps = round(((delta_sent * 8) / (1024**2)) / dt, 1)
            except Exception:
                pass

        # Measure TCP connect latency to 8.8.8.8:53 (fast & cross-platform)
        ping_ms = 20
        online = True
        try:
            t0 = time.time()
            s = socket.create_connection(("8.8.8.8", 53), timeout=0.8)
            s.close()
            ping_ms = int((time.time() - t0) * 1000)
        except Exception:
            online = False

        return {
            "down_mbps": down_mbps,
            "up_mbps": up_mbps,
            "ping_ms": ping_ms,
            "online": online
        }
