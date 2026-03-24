"""
SQLite database setup and schema for WindowsStorageSense.
All scan results are stored locally; no data leaves the machine.
"""

import sqlite3
import os
from pathlib import Path

DB_PATH = Path(os.getenv("APP_DATA_DIR", Path.home() / "AppData" / "Local" / "WindowsStorageSense")) / "storage_sense.db"


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create all tables if they do not exist."""
    conn = get_connection()
    try:
        cur = conn.cursor()

        cur.executescript("""
        CREATE TABLE IF NOT EXISTS drives (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            path        TEXT    NOT NULL UNIQUE,
            label       TEXT,
            drive_type  TEXT,       -- SSD | HDD | Network | Removable | Unknown
            total_bytes INTEGER,
            free_bytes  INTEGER,
            scanned_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS scan_sessions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            finished_at DATETIME,
            drive_paths TEXT,       -- JSON list of drives scanned
            status      TEXT DEFAULT 'running'
        );

        CREATE TABLE IF NOT EXISTS files (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id      INTEGER REFERENCES scan_sessions(id),
            path            TEXT    NOT NULL,
            name            TEXT    NOT NULL,
            extension       TEXT,
            size_bytes      INTEGER DEFAULT 0,
            category        TEXT,   -- Movies, Documents, Images, Music, Downloads, Games, Applications, Archives, Other
            last_accessed   DATETIME,
            last_modified   DATETIME,
            created_at_ts   DATETIME,
            is_symlink      INTEGER DEFAULT 0,
            partial_hash    TEXT,
            full_hash       TEXT,
            drive_path      TEXT,
            UNIQUE(path, session_id)
        );

        CREATE TABLE IF NOT EXISTS duplicate_groups (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  INTEGER REFERENCES scan_sessions(id),
            full_hash   TEXT    NOT NULL,
            file_count  INTEGER,
            total_wasted_bytes INTEGER
        );

        CREATE TABLE IF NOT EXISTS duplicate_files (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id    INTEGER REFERENCES duplicate_groups(id),
            file_id     INTEGER REFERENCES files(id),
            is_original INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS junk_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  INTEGER REFERENCES scan_sessions(id),
            category    TEXT    NOT NULL,  -- windows_temp, user_temp, prefetch, etc.
            path        TEXT    NOT NULL,
            size_bytes  INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS startup_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            command     TEXT,
            source      TEXT,   -- registry_hklm | registry_hkcu | startup_folder | task_scheduler
            source_path TEXT,
            enabled     INTEGER DEFAULT 1,
            impact      TEXT,   -- High | Medium | Low
            scanned_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS installed_apps (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT    NOT NULL,
            install_location TEXT,
            uninstall_cmd   TEXT,
            publisher       TEXT,
            install_date    TEXT,
            estimated_size  INTEGER,  -- as reported by registry
            real_size       INTEGER,  -- calculated from folder
            last_used       DATETIME,
            has_background  INTEGER DEFAULT 0,
            scanned_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS game_library (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT    NOT NULL,
            platform        TEXT,   -- Steam | Epic | GOG | EA | Ubisoft | Xbox | Local
            install_path    TEXT,
            size_bytes      INTEGER,
            last_played     DATETIME,
            app_id          TEXT,
            scanned_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            key     TEXT PRIMARY KEY,
            value   TEXT
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT,
            message     TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            read        INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_files_path        ON files(path);
        CREATE INDEX IF NOT EXISTS idx_files_category    ON files(category);
        CREATE INDEX IF NOT EXISTS idx_files_size        ON files(size_bytes DESC);
        CREATE INDEX IF NOT EXISTS idx_files_full_hash   ON files(full_hash);
        CREATE INDEX IF NOT EXISTS idx_files_session     ON files(session_id);
        CREATE INDEX IF NOT EXISTS idx_junk_session      ON junk_items(session_id);
        """)
        conn.commit()
    finally:
        conn.close()


def get_setting(key: str, default: str = "") -> str:
    conn = get_connection()
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default
    finally:
        conn.close()


def set_setting(key: str, value: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO settings(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )
        conn.commit()
    finally:
        conn.close()
