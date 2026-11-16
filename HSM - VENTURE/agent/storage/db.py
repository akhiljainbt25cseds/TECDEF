"""
SQLite Database Initializer for TechDef Sessions & Action Logs
"""
import sqlite3
from pathlib import Path

DB_FILE = Path(__file__).parent.parent / "techdef.db"

def get_connection(db_path: Path | None = None) -> sqlite3.Connection:
    target = db_path or DB_FILE
    conn = sqlite3.connect(str(target), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: Path | None = None) -> None:
    conn = get_connection(db_path)
    cur = conn.cursor()

    # Table 1: Gaming & Monitoring Sessions
    cur.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_secs INTEGER DEFAULT 0,
        avg_cpu_temp REAL DEFAULT 0.0,
        max_cpu_temp REAL DEFAULT 0.0,
        avg_gpu_temp REAL DEFAULT 0.0,
        max_gpu_temp REAL DEFAULT 0.0,
        throttle_events_count INTEGER DEFAULT 0
    );
    """)

    # Table 2: Thermal Throttle & Warning Events
    cur.execute("""
    CREATE TABLE IF NOT EXISTS throttle_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        timestamp TEXT NOT NULL,
        component TEXT NOT NULL,
        temp_c REAL NOT NULL,
        action_taken TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
    );
    """)

    # Table 3: Automated Actions & Reversible Overrides Log
    cur.execute("""
    CREATE TABLE IF NOT EXISTS action_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        trigger_metric TEXT NOT NULL,
        trigger_value REAL NOT NULL,
        action_type TEXT NOT NULL,
        target_component TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        is_reverted INTEGER DEFAULT 0
    );
    """)

    conn.commit()
    conn.close()
