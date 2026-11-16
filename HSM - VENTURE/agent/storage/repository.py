"""
Data Access Repository for Sessions, Throttle Events, and Action Logs
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from .db import get_connection

class HistoryRepository:
    def __init__(self, db_path=None):
        self.db_path = db_path

    def start_session(self, game_name: str) -> int:
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        now = datetime.now().isoformat()
        cur.execute(
            "INSERT INTO sessions (game_name, start_time) VALUES (?, ?)",
            (game_name, now)
        )
        conn.commit()
        session_id = cur.lastrowid
        conn.close()
        return session_id

    def update_session(self, session_id: int, avg_cpu: float, max_cpu: float, avg_gpu: float, max_gpu: float, duration_secs: int, throttle_count: int) -> None:
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        now = datetime.now().isoformat()
        cur.execute("""
            UPDATE sessions 
            SET end_time = ?, duration_secs = ?, avg_cpu_temp = ?, max_cpu_temp = ?, 
                avg_gpu_temp = ?, max_gpu_temp = ?, throttle_events_count = ?
            WHERE id = ?
        """, (now, duration_secs, avg_cpu, max_cpu, avg_gpu, max_gpu, throttle_count, session_id))
        conn.commit()
        conn.close()

    def get_recent_sessions(self, limit: int = 15) -> List[Dict[str, Any]]:
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT * FROM sessions ORDER BY id DESC LIMIT ?", (limit,))
        rows = [dict(row) for row in cur.fetchall()]
        conn.close()
        return rows

    def log_throttle_event(self, session_id: Optional[int], component: str, temp_c: float, action_taken: str) -> int:
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        now = datetime.now().isoformat()
        cur.execute("""
            INSERT INTO throttle_events (session_id, timestamp, component, temp_c, action_taken)
            VALUES (?, ?, ?, ?, ?)
        """, (session_id, now, component, temp_c, action_taken))
        conn.commit()
        event_id = cur.lastrowid
        conn.close()
        return event_id

    def log_action(self, rule_id: str, trigger_metric: str, trigger_val: float, action_type: str, component: str, old_val: str, new_val: str) -> int:
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        now = datetime.now().isoformat()
        cur.execute("""
            INSERT INTO action_logs (timestamp, rule_id, trigger_metric, trigger_value, action_type, target_component, old_value, new_value, is_reverted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        """, (now, rule_id, trigger_metric, trigger_val, action_type, component, str(old_val), str(new_val)))
        conn.commit()
        log_id = cur.lastrowid
        conn.close()
        return log_id

    def get_action_logs(self, limit: int = 30) -> List[Dict[str, Any]]:
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT * FROM action_logs ORDER BY id DESC LIMIT ?", (limit,))
        rows = [dict(row) for row in cur.fetchall()]
        conn.close()
        return rows

    def mark_action_reverted(self, action_id: int) -> bool:
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("UPDATE action_logs SET is_reverted = 1 WHERE id = ?", (action_id,))
        conn.commit()
        updated = cur.rowcount > 0
        conn.close()
        return updated

    def seed_demo_sessions_if_empty(self) -> None:
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM sessions")
        count = cur.fetchone()[0]
        if count == 0:
            demo_sessions = [
                ("Cyberpunk 2077", "2026-10-22T20:15:00", "2026-10-22T21:45:00", 5400, 78.4, 86.2, 74.1, 82.0, 1),
                ("Counter-Strike 2", "2026-10-23T18:00:00", "2026-10-23T19:20:00", 4800, 71.2, 79.5, 68.3, 75.4, 0),
                ("Valorant", "2026-10-24T15:30:00", "2026-10-24T17:00:00", 5400, 69.8, 77.0, 66.5, 73.2, 0),
                ("Elden Ring", "2026-10-25T21:00:00", "2026-10-25T22:50:00", 6600, 81.3, 89.6, 76.8, 85.1, 3),
                ("Call of Duty: Warzone", "2026-10-26T00:10:00", "2026-10-26T01:30:00", 4800, 82.5, 91.0, 78.2, 87.5, 4),
            ]
            for s in demo_sessions:
                cur.execute("""
                    INSERT INTO sessions (game_name, start_time, end_time, duration_secs, avg_cpu_temp, max_cpu_temp, avg_gpu_temp, max_gpu_temp, throttle_events_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, s)
            conn.commit()
        conn.close()

    def get_session_trends(self) -> Dict[str, Any]:
        self.seed_demo_sessions_if_empty()
        conn = get_connection(self.db_path)
        cur = conn.cursor()

        cur.execute("""
            SELECT 
                COUNT(*) as total_sessions,
                COALESCE(SUM(duration_secs), 0) as total_duration_secs,
                COALESCE(AVG(avg_cpu_temp), 0.0) as overall_avg_cpu,
                COALESCE(MAX(max_cpu_temp), 0.0) as peak_cpu,
                COALESCE(AVG(avg_gpu_temp), 0.0) as overall_avg_gpu,
                COALESCE(MAX(max_gpu_temp), 0.0) as peak_gpu,
                COALESCE(SUM(throttle_events_count), 0) as total_throttles
            FROM sessions
        """)
        row = cur.fetchone()
        stats = {
            "total_sessions": row[0],
            "total_gaming_hours": round(row[1] / 3600.0, 1),
            "overall_avg_cpu": round(row[2], 1),
            "peak_cpu": round(row[3], 1),
            "overall_avg_gpu": round(row[4], 1),
            "peak_gpu": round(row[5], 1),
            "total_throttles": row[6],
        }

        # Daily breakdown for trends
        cur.execute("""
            SELECT 
                SUBSTR(start_time, 1, 10) as day,
                COUNT(*) as count,
                ROUND(SUM(duration_secs) / 60.0, 0) as minutes,
                MAX(max_cpu_temp) as max_temp,
                SUM(throttle_events_count) as throttles
            FROM sessions
            GROUP BY SUBSTR(start_time, 1, 10)
            ORDER BY day ASC
            LIMIT 14
        """)
        daily = []
        for r in cur.fetchall():
            daily.append({
                "date": r[0],
                "sessions": r[1],
                "minutes": int(r[2]),
                "max_temp": float(r[3] or 0.0),
                "throttles": int(r[4] or 0)
            })
        stats["daily_trends"] = daily
        conn.close()
        return stats

    def get_all_issues(self, limit: int = 50) -> List[Dict[str, Any]]:
        conn = get_connection(self.db_path)
        cur = conn.cursor()
        
        # 1. Fetch from throttle_events joined with sessions
        cur.execute("""
            SELECT 
                t.id,
                t.timestamp,
                t.component,
                t.temp_c,
                t.action_taken,
                COALESCE(s.game_name, 'Online Gaming / FivePlay') as game_name
            FROM throttle_events t
            LEFT JOIN sessions s ON t.session_id = s.id
            ORDER BY t.id DESC
            LIMIT ?
        """, (limit,))
        
        events = []
        for r in cur.fetchall():
            temp = float(r[3])
            severity = "critical" if temp >= 90.0 else "warning"
            events.append({
                "id": f"th_{r[0]}",
                "type": "thermal_throttle",
                "severity": severity,
                "timestamp": r[1],
                "component": r[2],
                "temp_c": temp,
                "game": r[5],
                "action_taken": r[4],
                "title": f"{'🚨 Critical Overheat & Throttle' if severity == 'critical' else '⚠️ High Temperature Anomaly'} ({temp}°C)",
                "description": f"Silicon temperature peaked at {temp}°C on {r[2]} while running {r[5]}. Thermal threshold exceeded.",
                "mitigation": "Autonomous governor triggered emergency cooling and power ceiling limit.",
                "status": "Resolved & Stabilized"
            })
            
        # 2. Also fetch emergency action logs
        cur.execute("""
            SELECT id, timestamp, rule_id, trigger_metric, trigger_value, action_type, target_component, new_value
            FROM action_logs
            WHERE trigger_value >= 80.0 OR rule_id LIKE '%overheat%' OR rule_id LIKE '%crit%' OR rule_id LIKE '%warn%'
            ORDER BY id DESC
            LIMIT ?
        """, (limit,))
        
        for a in cur.fetchall():
            val = float(a[4])
            events.append({
                "id": f"act_{a[0]}",
                "type": "autonomous_action",
                "severity": "critical" if val >= 92.0 else "warning",
                "timestamp": a[1],
                "component": a[6],
                "temp_c": val,
                "game": "System Background / Game",
                "action_taken": f"{a[5]} (Set to {a[7]})",
                "title": f"Autonomous Mitigation: {a[2].replace('_', ' ').title()}",
                "description": f"Trigger metric {a[3]} reached {val}°C. Autonomous engine engaged protection.",
                "mitigation": f"Forced {a[6]} to {a[7]} to dissipate thermal saturation.",
                "status": "Applied"
            })
            
        # Sort combined events by timestamp desc
        events.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)
        conn.close()
        return events[:limit]


