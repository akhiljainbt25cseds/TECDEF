"""
TechDef Pro: Community Backend
Stores and serves user-submitted spec cards, experiences, and session shares.
Uses SQLite — no external services, fully local.
"""
import re
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

COMMUNITY_DB = Path(__file__).parent / "community.db"

# ─── DB Init ────────────────────────────────────────────────────────────────

def init_community_db(db_path: Path = None) -> None:
    target = db_path or COMMUNITY_DB
    conn = sqlite3.connect(str(target), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS community_posts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at  TEXT    NOT NULL,
        username    TEXT    NOT NULL DEFAULT 'Anonymous',
        title       TEXT    NOT NULL,
        body        TEXT    NOT NULL,
        post_type   TEXT    NOT NULL DEFAULT 'experience',  -- 'experience' | 'spec_share' | 'tip'
        cpu_name    TEXT,
        gpu_name    TEXT,
        avg_cpu_temp REAL,
        avg_gpu_temp REAL,
        os_platform TEXT,
        likes       INTEGER NOT NULL DEFAULT 0,
        is_pinned   INTEGER NOT NULL DEFAULT 0
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS community_comments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id     INTEGER NOT NULL,
        created_at  TEXT    NOT NULL,
        username    TEXT    NOT NULL DEFAULT 'Anonymous',
        body        TEXT    NOT NULL,
        FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()


def _get_conn(db_path: Path = None) -> sqlite3.Connection:
    target = db_path or COMMUNITY_DB
    conn = sqlite3.connect(str(target), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Repository ─────────────────────────────────────────────────────────────

class CommunityRepository:
    def __init__(self, db_path: Path = None):
        self.db_path = db_path or COMMUNITY_DB
        init_community_db(self.db_path)
        self._seed_demo()

    def _seed_demo(self) -> None:
        conn = _get_conn(self.db_path)
        cur  = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM community_posts")
        if cur.fetchone()[0] == 0:
            demo = [
                ("GrindSet99",   "My RTX 4080 Laptop finally stopped throttling!",
                 "After 6 months of thermal issues I cleaned the heatsink and replaced thermal paste. "
                 "Temps dropped from 95°C to 74°C under load. Night and day difference.",
                 "experience", "Intel Core i9-13900HX", "NVIDIA RTX 4080 Laptop", 74.0, 72.5, "Windows 11", 42, 1),

                ("NightOwlRig",  "Spec Share — Alienware m18 R2 Build",
                 "Running Cyberpunk 2077 at 4K Ultra. CPU averages 78°C, GPU 81°C. "
                 "TechDef caught a throttle event I would have completely missed. Great tool!",
                 "spec_share", "Intel Core i9-14900HX", "NVIDIA RTX 4090 Laptop", 78.0, 81.0, "Windows 11", 28, 0),

                ("QuietPC_Fan",  "Tip: Cooling pad makes a HUGE difference",
                 "I was skeptical but a $25 cooling pad dropped my idle temps by 8°C and gaming temps by 12°C. "
                 "Combined with TechDef's fan alerts, I finally have peace of mind.",
                 "tip", None, None, None, None, "Windows 10", 35, 0),

                ("ValGrinder",   "Valorant stays under 70°C now",
                 "Used the fan control tab to set a custom 75% fan curve during ranked matches. "
                 "CPU never goes above 70°C. No more frame drops from thermal throttling mid-match.",
                 "experience", "AMD Ryzen 7 7745HX", "NVIDIA RTX 4070 Ti Super", 68.0, 66.0, "Windows 11", 19, 0),
            ]
            for d in demo:
                days_ago = -(demo.index(d) * 2)
                cur.execute("""
                    INSERT INTO community_posts
                    (created_at, username, title, body, post_type, cpu_name, gpu_name,
                     avg_cpu_temp, avg_gpu_temp, os_platform, likes, is_pinned)
                    VALUES (datetime('now', ? || ' days'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(days_ago),
                    d[0], d[1], d[2], d[3], d[4], d[5],
                    d[6], d[7], d[8], d[9], d[10]
                ))
            conn.commit()
        conn.close()

    def get_posts(self, limit: int = 50, post_type: str = None) -> List[Dict[str, Any]]:
        conn = _get_conn(self.db_path)
        cur  = conn.cursor()
        if post_type:
            cur.execute("""
                SELECT * FROM community_posts
                WHERE post_type = ?
                ORDER BY is_pinned DESC, created_at DESC LIMIT ?
            """, (post_type, limit))
        else:
            cur.execute("""
                SELECT * FROM community_posts
                ORDER BY is_pinned DESC, created_at DESC LIMIT ?
            """, (limit,))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        # Attach comment counts
        conn2 = _get_conn(self.db_path)
        cur2  = conn2.cursor()
        for row in rows:
            cur2.execute("SELECT COUNT(*) FROM community_comments WHERE post_id=?", (row["id"],))
            row["comment_count"] = cur2.fetchone()[0]
        conn2.close()
        return rows

    def get_post(self, post_id: int) -> Optional[Dict[str, Any]]:
        conn = _get_conn(self.db_path)
        cur  = conn.cursor()
        cur.execute("SELECT * FROM community_posts WHERE id=?", (post_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return None
        post = dict(row)
        # Get comments
        conn2 = _get_conn(self.db_path)
        cur2  = conn2.cursor()
        cur2.execute("SELECT * FROM community_comments WHERE post_id=? ORDER BY created_at ASC", (post_id,))
        post["comments"] = [dict(r) for r in cur2.fetchall()]
        conn2.close()
        return post

    def create_post(self, data: Dict[str, Any]) -> Dict[str, Any]:
        username = (data.get("username") or "Anonymous").strip()[:40]
        title    = (data.get("title")    or "").strip()[:120]
        body     = (data.get("body")     or "").strip()[:2000]
        post_type = data.get("post_type", "experience")
        if post_type not in ("experience", "spec_share", "tip"):
            post_type = "experience"
        if not title or not body:
            raise ValueError("title and body are required")

        conn = _get_conn(self.db_path)
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO community_posts
            (created_at, username, title, body, post_type, cpu_name, gpu_name,
             avg_cpu_temp, avg_gpu_temp, os_platform, likes, is_pinned)
            VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        """, (
            username, title, body, post_type,
            data.get("cpu_name"), data.get("gpu_name"),
            data.get("avg_cpu_temp"), data.get("avg_gpu_temp"),
            data.get("os_platform"),
        ))
        conn.commit()
        post_id = cur.lastrowid
        conn.close()
        return self.get_post(post_id)

    def like_post(self, post_id: int) -> int:
        conn = _get_conn(self.db_path)
        cur  = conn.cursor()
        cur.execute("UPDATE community_posts SET likes = likes + 1 WHERE id=?", (post_id,))
        conn.commit()
        cur.execute("SELECT likes FROM community_posts WHERE id=?", (post_id,))
        row = cur.fetchone()
        conn.close()
        return row[0] if row else 0

    def add_comment(self, post_id: int, username: str, body: str) -> Dict[str, Any]:
        username = (username or "Anonymous").strip()[:40]
        body     = (body     or "").strip()[:1000]
        if not body:
            raise ValueError("comment body is required")
        conn = _get_conn(self.db_path)
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO community_comments (post_id, created_at, username, body)
            VALUES (?, datetime('now'), ?, ?)
        """, (post_id, username, body))
        conn.commit()
        comment_id = cur.lastrowid
        cur.execute("SELECT * FROM community_comments WHERE id=?", (comment_id,))
        row = dict(cur.fetchone())
        conn.close()
        return row

    def get_stats(self) -> Dict[str, Any]:
        conn = _get_conn(self.db_path)
        cur  = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM community_posts")
        total_posts = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM community_comments")
        total_comments = cur.fetchone()[0]
        cur.execute("SELECT COALESCE(SUM(likes),0) FROM community_posts")
        total_likes = cur.fetchone()[0]
        cur.execute("SELECT COUNT(DISTINCT username) FROM community_posts")
        total_members = cur.fetchone()[0]
        conn.close()
        return {
            "total_posts":    total_posts,
            "total_comments": total_comments,
            "total_likes":    total_likes,
            "total_members":  total_members,
        }
