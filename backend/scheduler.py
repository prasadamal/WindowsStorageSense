"""
Background scheduler — uses APScheduler to run periodic scans.
Integrates with Windows Task Scheduler for persistent scheduling.
Sends Windows tray notifications when significant junk is found.
"""

import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

from database import get_connection, get_setting, set_setting


try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    HAS_APSCHEDULER = True
except ImportError:
    HAS_APSCHEDULER = False


_scheduler: Optional["BackgroundScheduler"] = None

DEFAULT_THRESHOLD_GB = 5.0


def _run_background_scan():
    """Called by APScheduler — scans drives and notifies if junk threshold exceeded."""
    from scanner import list_drives, start_scan, get_latest_session_id
    from junk_cleaner import scan_junk
    import asyncio

    drives = [d["path"] for d in list_drives()]
    loop = asyncio.new_event_loop()
    session_id = loop.run_until_complete(start_scan(drives))
    loop.close()

    # Wait for scan (simple poll)
    import time
    for _ in range(600):
        conn = get_connection()
        row = conn.execute(
            "SELECT status FROM scan_sessions WHERE id=?", (session_id,)
        ).fetchone()
        conn.close()
        if row and row["status"] == "complete":
            break
        time.sleep(2)

    junk = scan_junk(session_id)
    total_junk_bytes = sum(c.get("size_bytes", 0) for c in junk)
    threshold_bytes = float(get_setting("junk_threshold_gb", str(DEFAULT_THRESHOLD_GB))) * 1_073_741_824

    if total_junk_bytes >= threshold_bytes:
        gb = total_junk_bytes / 1_073_741_824
        _send_notification(
            "WindowsStorageSense",
            f"You've accumulated {gb:.1f} GB of cleanable files since your last cleanup — review now.",
        )


def _send_notification(title: str, message: str):
    """Display a Windows system tray notification via PowerShell."""
    script = f"""
Add-Type -AssemblyName System.Windows.Forms
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.BalloonTipIcon = 'Info'
$notify.BalloonTipTitle = '{title}'
$notify.BalloonTipText = '{message}'
$notify.Visible = $true
$notify.ShowBalloonTip(5000)
Start-Sleep -Seconds 6
$notify.Dispose()
"""
    try:
        subprocess.Popen(
            ["powershell", "-WindowStyle", "Hidden", "-Command", script],
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    except Exception:
        pass


def start_scheduler(cron_hour: int = 2, cron_day_of_week: str = "sun"):
    global _scheduler
    if not HAS_APSCHEDULER:
        return {"error": "apscheduler not installed"}
    if _scheduler and _scheduler.running:
        return {"status": "already_running"}

    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _run_background_scan,
        CronTrigger(day_of_week=cron_day_of_week, hour=cron_hour),
        id="weekly_scan",
        replace_existing=True,
    )
    _scheduler.start()
    return {"status": "started", "schedule": f"weekly on {cron_day_of_week} at {cron_hour}:00"}


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown()
        return {"status": "stopped"}
    return {"status": "not_running"}


def register_windows_task(interval_days: int = 7):
    """
    Register a Windows Task Scheduler task for persistent background scanning.
    Runs as the current user without elevation.
    """
    import sys
    task_name = "WindowsStorageSense_WeeklyScan"
    python_exe = sys.executable
    script = str(Path(__file__).parent / "main.py")

    xml = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <CalendarTrigger>
      <Repetition>
        <Interval>P{interval_days}D</Interval>
      </Repetition>
      <StartBoundary>2024-01-01T02:00:00</StartBoundary>
      <ScheduleByDay>
        <DaysInterval>7</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Actions>
    <Exec>
      <Command>{python_exe}</Command>
      <Arguments>"{script}" --background-scan</Arguments>
    </Exec>
  </Actions>
</Task>"""

    xml_path = Path.home() / "AppData" / "Local" / "Temp" / "wss_task.xml"
    xml_path.write_text(xml, encoding="utf-16")

    try:
        result = subprocess.run(
            ["schtasks", "/Create", "/TN", task_name, "/XML", str(xml_path), "/F"],
            capture_output=True, text=True, timeout=30,
        )
        return {"success": result.returncode == 0, "output": result.stdout}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        xml_path.unlink(missing_ok=True)
