"""
WindowsStorageSense — Python FastAPI backend.

Exposes a local HTTP API on port 8765.
All communication with the Electron frontend goes through this API.

Run:  uvicorn main:app --host 127.0.0.1 --port 8765
"""

import argparse
import asyncio
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional, Any

from fastapi import FastAPI, HTTPException, BackgroundTasks, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import init_db, get_connection, get_setting, set_setting
from scanner import (
    list_drives,
    start_scan,
    get_scan_status,
    get_top_files,
    get_category_summary,
    get_latest_session_id,
)
from duplicate_finder import find_duplicates, get_duplicate_groups
from stale_files import get_stale_files
from junk_cleaner import scan_junk, delete_junk_categories
from startup_manager import list_startup_items, toggle_startup_item
from game_library import detect_all_games, get_games_from_db, get_total_game_size
from drive_optimizer import get_drive_optimization
from download_manager import list_downloads, organize_downloads, delete_stale_downloads
from scheduler import start_scheduler, stop_scheduler, register_windows_task
from safety import is_blocked_path
import file_explorer as fe
import media_organizer as mo
import quick_transfer as qt
import smart_optimizer as so
import deep_analyzer as da
import internet_transfer as it_
import system_monitor as sm
import report_exporter as re_

import send2trash


# ---------------------------------------------------------------------------
# Simple in-memory response cache
# ---------------------------------------------------------------------------

class _Cache:
    """Lightweight TTL cache for expensive read-only endpoints."""
    def __init__(self):
        self._store: dict[str, tuple[float, object]] = {}

    def get(self, key: str, ttl: float) -> Optional[Any]:
        entry = self._store.get(key)
        if entry and (time.monotonic() - entry[0]) < ttl:
            return entry[1]
        return None

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (time.monotonic(), value)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def invalidate_all(self) -> None:
        self._store.clear()


_cache = _Cache()


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="WindowsStorageSense API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:*", "file://"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    drive_paths: list[str]


class DeleteJunkRequest(BaseModel):
    category_ids: list[str]
    session_id: int


class UninstallRequest(BaseModel):
    app_name: str
    uninstall_cmd: str


class DeleteLeftoversRequest(BaseModel):
    paths: list[str]


class ToggleStartupRequest(BaseModel):
    name: str
    source_path: str
    enabled: bool


class SettingRequest(BaseModel):
    key: str
    value: str


class DeleteFilesRequest(BaseModel):
    paths: list[str]


# --- File Explorer ---

class CreateFolderRequest(BaseModel):
    parent_path: str
    name: str


class RenameRequest(BaseModel):
    path: str
    new_name: str


class MoveRequest(BaseModel):
    paths: list[str]
    destination: str


class CopyRequest(BaseModel):
    paths: list[str]
    destination: str


class DeleteItemsRequest(BaseModel):
    paths: list[str]


class OpenFileRequest(BaseModel):
    path: str


class SearchRequest(BaseModel):
    root_path: str
    query: str
    limit: int = 200


# --- Media Organizer ---

class MediaPreviewRequest(BaseModel):
    scan_paths: list[str]
    categories: list[str] | None = None


class MediaOrganizeRequest(BaseModel):
    scan_paths: list[str]
    categories: list[str] | None = None
    dry_run: bool = False


# --- Quick Transfer ---

class ShareStartRequest(BaseModel):
    file_paths: list[str]
    port: int = 0


# --- Smart Optimizer ---

class DeleteEmptyFoldersRequest(BaseModel):
    paths: list[str]


class ScanPathsRequest(BaseModel):
    root_paths: list[str]


class MergeFoldersRequest(BaseModel):
    source: str
    destination: str
    dry_run: bool = True


class MoveFilesRequest(BaseModel):
    paths: list[str]
    destination: str


# --- Internet Transfer ---

class InternetUploadRequest(BaseModel):
    file_path: str
    expires: str = "14d"


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ---------------------------------------------------------------------------
# Drives
# ---------------------------------------------------------------------------

@app.get("/drives")
async def get_drives():
    return {"drives": list_drives()}


# ---------------------------------------------------------------------------
# Scanning
# ---------------------------------------------------------------------------

@app.post("/scan/start")
async def api_start_scan(req: ScanRequest, background_tasks: BackgroundTasks):
    session_id = await start_scan(req.drive_paths)
    return {"session_id": session_id, "status": "started"}


@app.get("/scan/{session_id}/status")
async def api_scan_status(session_id: int):
    return await get_scan_status(session_id)


@app.get("/scan/latest")
async def api_latest_session():
    sid = await get_latest_session_id()
    if sid is None:
        return {"session_id": None}
    status = await get_scan_status(sid)
    return status


# ---------------------------------------------------------------------------
# Dashboard / Overview
# ---------------------------------------------------------------------------

@app.get("/dashboard")
async def api_dashboard():
    """Aggregated dashboard data loaded from cached SQLite results."""
    cached = _cache.get("dashboard", ttl=30)
    if cached is not None:
        return cached

    sid = await get_latest_session_id()
    if sid is None:
        return {"has_data": False}

    drives = list_drives()
    top_files = await get_top_files(sid, limit=5)
    categories = await get_category_summary(sid)

    # System health score (0-100)
    junk_info = scan_junk(sid)
    total_junk = sum(c.get("size_bytes", 0) for c in junk_info)
    total_drive_space = sum(d.get("total_bytes", 0) for d in drives)
    junk_pct = (total_junk / total_drive_space * 100) if total_drive_space else 0
    health_score = max(0, min(100, int(100 - junk_pct * 2)))

    # Quick wins
    quick_wins = []
    downloads_info = list_downloads()
    if downloads_info["total_bytes"] > 1_073_741_824:
        gb = downloads_info["total_bytes"] / 1_073_741_824
        quick_wins.append({
            "title": "Downloads Folder",
            "description": f"Your Downloads folder has {gb:.1f} GB — review it",
            "action": "downloads",
            "bytes": downloads_info["total_bytes"],
        })
    if total_junk > 536_870_912:
        gb = total_junk / 1_073_741_824
        quick_wins.append({
            "title": "Junk Files",
            "description": f"{gb:.1f} GB of junk files detected — clean now",
            "action": "junk",
            "bytes": total_junk,
        })

    # Real-time system stats for dashboard widget
    sys_stats = sm.get_full_snapshot()

    result = {
        "has_data": True,
        "session_id": sid,
        "drives": drives,
        "top_files": top_files,
        "categories": categories,
        "health_score": health_score,
        "junk_bytes": total_junk,
        "quick_wins": quick_wins,
        "system": sys_stats,
    }
    _cache.set("dashboard", result)
    return result


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------

@app.get("/files/top")
async def api_top_files(session_id: Optional[int] = None, limit: int = 50):
    if session_id is None:
        session_id = await get_latest_session_id()
    if session_id is None:
        return {"files": []}
    return {"files": await get_top_files(session_id, limit=limit)}


@app.get("/files/categories")
async def api_categories(session_id: Optional[int] = None):
    if session_id is None:
        session_id = await get_latest_session_id()
    if session_id is None:
        return {"categories": []}
    return {"categories": await get_category_summary(session_id)}


@app.get("/files/by-category/{category}")
async def api_files_by_category(category: str, session_id: Optional[int] = None, limit: int = 200):
    if session_id is None:
        session_id = await get_latest_session_id()
    if session_id is None:
        return {"files": []}
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT path, name, extension, size_bytes, category, last_accessed, last_modified, drive_path
            FROM files
            WHERE session_id=? AND category=? AND is_symlink=0
            ORDER BY size_bytes DESC
            LIMIT ?
            """,
            (session_id, category, limit),
        ).fetchall()
        return {"category": category, "files": [dict(r) for r in rows]}
    finally:
        conn.close()


@app.post("/files/delete")
async def api_delete_files(req: DeleteFilesRequest):
    """Send specified files to Recycle Bin — never permanent delete."""
    errors = []
    deleted = 0
    for path in req.paths:
        if is_blocked_path(path):
            errors.append(f"Blocked path: {path}")
            continue
        try:
            send2trash.send2trash(path)
            deleted += 1
        except Exception as e:
            errors.append(f"{path}: {e}")
    return {"deleted": deleted, "errors": errors}


# ---------------------------------------------------------------------------
# Duplicates
# ---------------------------------------------------------------------------

@app.post("/duplicates/scan")
async def api_find_duplicates(
    background_tasks: BackgroundTasks,
    session_id: Optional[int] = None,
    include_images: bool = True,
):
    if session_id is None:
        session_id = await get_latest_session_id()
    if session_id is None:
        raise HTTPException(404, "No scan session found. Run a disk scan first.")

    def run_dupe_scan():
        find_duplicates(session_id, include_images=include_images)

    background_tasks.add_task(run_dupe_scan)
    return {"status": "started", "session_id": session_id}


@app.get("/duplicates")
async def api_get_duplicates(session_id: Optional[int] = None):
    if session_id is None:
        session_id = await get_latest_session_id()
    if session_id is None:
        return {"groups": []}
    return {"groups": get_duplicate_groups(session_id)}


# ---------------------------------------------------------------------------
# Stale Files
# ---------------------------------------------------------------------------

@app.get("/stale")
async def api_stale_files(session_id: Optional[int] = None, threshold_days: int = 365):
    if session_id is None:
        session_id = await get_latest_session_id()
    if session_id is None:
        return {"files": [], "total_bytes": 0}
    return get_stale_files(session_id, threshold_days=threshold_days)


# ---------------------------------------------------------------------------
# Junk Cleaner
# ---------------------------------------------------------------------------

@app.get("/junk/scan")
async def api_junk_scan(session_id: Optional[int] = None):
    if session_id is None:
        session_id = await get_latest_session_id()
    categories = scan_junk(session_id or 0)
    return {"categories": categories}


@app.post("/junk/delete")
async def api_junk_delete(req: DeleteJunkRequest):
    result = delete_junk_categories(req.category_ids)
    return result


# ---------------------------------------------------------------------------
# Uninstaller
# ---------------------------------------------------------------------------

@app.get("/apps")
async def api_list_apps():
    try:
        from uninstaller import list_installed_apps
        apps = list_installed_apps()
        return {"apps": apps}
    except Exception as e:
        return {"apps": [], "error": str(e)}


@app.post("/apps/uninstall")
async def api_uninstall(req: UninstallRequest):
    from uninstaller import uninstall_app
    return uninstall_app(req.app_name, req.uninstall_cmd)


@app.get("/apps/leftovers")
async def api_leftovers(app_name: str, install_location: str = ""):
    from uninstaller import find_leftovers
    return find_leftovers(app_name, install_location)


@app.post("/apps/leftovers/delete")
async def api_delete_leftovers(req: DeleteLeftoversRequest):
    from uninstaller import delete_leftovers
    return delete_leftovers(req.paths)


# ---------------------------------------------------------------------------
# Startup Manager
# ---------------------------------------------------------------------------

@app.get("/startup")
async def api_startup_items():
    try:
        items = list_startup_items()
        return {"items": items}
    except Exception as e:
        return {"items": [], "error": str(e)}


@app.post("/startup/toggle")
async def api_toggle_startup(req: ToggleStartupRequest):
    return toggle_startup_item(req.name, req.source_path, req.enabled)


# ---------------------------------------------------------------------------
# Game Library
# ---------------------------------------------------------------------------

@app.get("/games")
async def api_games(rescan: bool = False):
    if rescan:
        games = detect_all_games()
    else:
        games = get_games_from_db()
    total = get_total_game_size()
    return {"games": games, "total_bytes": total}


# ---------------------------------------------------------------------------
# Drive Optimizer
# ---------------------------------------------------------------------------

@app.get("/drives/optimize")
async def api_drive_optimize(session_id: Optional[int] = None):
    if session_id is None:
        session_id = await get_latest_session_id()
    if session_id is None:
        return {"recommendations": {"applicable": False}}
    return get_drive_optimization(session_id)


# ---------------------------------------------------------------------------
# Downloads
# ---------------------------------------------------------------------------

@app.get("/downloads")
async def api_downloads(stale_days: int = 90):
    return list_downloads(stale_days=stale_days)


@app.post("/downloads/organize")
async def api_organize_downloads():
    return organize_downloads()


@app.post("/downloads/delete-stale")
async def api_delete_stale_downloads(stale_days: int = 90):
    return delete_stale_downloads(stale_days=stale_days)


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

@app.get("/settings")
async def api_get_settings():
    conn = get_connection()
    try:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {r["key"]: r["value"] for r in rows}
    finally:
        conn.close()


@app.post("/settings")
async def api_set_setting(req: SettingRequest):
    set_setting(req.key, req.value)
    return {"success": True}


# ---------------------------------------------------------------------------
# Scheduler
# ---------------------------------------------------------------------------

@app.post("/scheduler/register-task")
async def api_register_task(interval_days: int = 7):
    return register_windows_task(interval_days=interval_days)


# ---------------------------------------------------------------------------
# File Explorer
# ---------------------------------------------------------------------------

@app.get("/explorer/list")
async def api_explorer_list(path: str, show_hidden: bool = False):
    try:
        return fe.list_directory(path, show_hidden=show_hidden)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except NotADirectoryError as e:
        raise HTTPException(400, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))


@app.get("/explorer/quick-access")
async def api_quick_access():
    return {"locations": fe.get_quick_access()}


@app.post("/explorer/folder")
async def api_create_folder(req: CreateFolderRequest):
    try:
        return fe.create_folder(req.parent_path, req.name)
    except (PermissionError, FileExistsError) as e:
        raise HTTPException(403, str(e))


@app.post("/explorer/rename")
async def api_rename(req: RenameRequest):
    try:
        return fe.rename_item(req.path, req.new_name)
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@app.post("/explorer/move")
async def api_move(req: MoveRequest):
    return fe.move_items(req.paths, req.destination)


@app.post("/explorer/copy")
async def api_copy(req: CopyRequest):
    return fe.copy_items(req.paths, req.destination)


@app.post("/explorer/delete")
async def api_explorer_delete(req: DeleteItemsRequest):
    return fe.delete_items(req.paths)


@app.post("/explorer/open")
async def api_open_file(req: OpenFileRequest):
    return fe.open_file(req.path)


@app.post("/explorer/open-in-explorer")
async def api_open_in_explorer(req: OpenFileRequest):
    return fe.open_in_explorer(req.path)


@app.get("/explorer/search")
async def api_explorer_search(root_path: str, query: str, limit: int = 200):
    return {"results": fe.search_files(root_path, query, limit)}


# ---------------------------------------------------------------------------
# Media Organizer
# ---------------------------------------------------------------------------

@app.post("/media/preview")
async def api_media_preview(req: MediaPreviewRequest):
    return mo.preview_organization(req.scan_paths, req.categories)


@app.post("/media/organize")
async def api_media_organize(req: MediaOrganizeRequest):
    return mo.organize_media(req.scan_paths, req.categories, dry_run=req.dry_run)


@app.get("/media/library-stats")
async def api_library_stats():
    return mo.get_library_stats()


# ---------------------------------------------------------------------------
# Quick Transfer
# ---------------------------------------------------------------------------

@app.post("/transfer/start")
async def api_transfer_start(req: ShareStartRequest):
    result = qt.start_share(req.file_paths, port=req.port)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@app.post("/transfer/stop")
async def api_transfer_stop():
    return qt.stop_share()


@app.get("/transfer/status")
async def api_transfer_status():
    return qt.get_share_status()


# ---------------------------------------------------------------------------
# Smart Optimizer
# ---------------------------------------------------------------------------

@app.post("/optimizer/empty-folders/scan")
async def api_scan_empty(req: ScanPathsRequest):
    return {"folders": so.scan_empty_folders(req.root_paths)}


@app.post("/optimizer/empty-folders/delete")
async def api_delete_empty(req: DeleteEmptyFoldersRequest):
    return so.delete_empty_folders(req.paths)


@app.post("/optimizer/similar-folders/scan")
async def api_similar_folders(req: ScanPathsRequest):
    return {"groups": so.find_similar_folders(req.root_paths)}


@app.post("/optimizer/merge-folders")
async def api_merge_folders(req: MergeFoldersRequest):
    return so.merge_folders(req.source, req.destination, dry_run=req.dry_run)


@app.get("/optimizer/c-drive-hogs")
async def api_c_drive_hogs(min_size_mb: int = 100, top_n: int = 25):
    return {"hogs": so.get_c_drive_hogs(min_size_mb=min_size_mb, top_n=top_n)}


@app.get("/optimizer/drive-placement")
async def api_drive_placement():
    return so.get_drive_placement_advice()


@app.post("/optimizer/scattered-files/scan")
async def api_scattered_files(req: ScanPathsRequest):
    return {"files": so.find_scattered_files(req.root_paths)}


@app.post("/optimizer/scattered-files/consolidate")
async def api_consolidate_scattered(req: MoveFilesRequest):
    return fe.move_items(req.paths, req.destination)


# ---------------------------------------------------------------------------
# Deep Analyzer
# ---------------------------------------------------------------------------

@app.post("/analyzer/run")
async def api_analyzer_run(req: ScanPathsRequest, top_files: int = 50):
    return da.analyze(req.root_paths, top_files=top_files)


@app.post("/analyzer/largest-files")
async def api_largest_files(req: ScanPathsRequest, limit: int = 100):
    return {"files": da.get_largest_files(req.root_paths, limit=limit)}


@app.post("/analyzer/extension-stats")
async def api_extension_stats(req: ScanPathsRequest):
    return {"stats": da.get_extension_stats(req.root_paths)}


@app.post("/analyzer/age-distribution")
async def api_age_distribution(req: ScanPathsRequest):
    return {"buckets": da.get_age_distribution(req.root_paths)}


@app.post("/analyzer/orphaned-files")
async def api_orphaned_files(req: ScanPathsRequest, limit: int = 200):
    return {"files": da.find_orphaned_files(req.root_paths, limit=limit)}


@app.get("/analyzer/folder-tree")
async def api_folder_tree(root_path: str, depth: int = 3):
    return da.get_folder_tree(root_path, depth=depth)


# ---------------------------------------------------------------------------
# Internet & Bluetooth Transfer
# ---------------------------------------------------------------------------

@app.post("/transfer/internet-upload")
async def api_internet_upload(req: InternetUploadRequest):
    result = await it_.upload_file(req.file_path, expires=req.expires)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@app.post("/transfer/bluetooth")
async def api_bluetooth_send():
    return it_.launch_bluetooth_send()


# ---------------------------------------------------------------------------
# System Monitor
# ---------------------------------------------------------------------------

@app.get("/system/stats")
async def api_system_stats():
    """Real-time CPU, RAM, disk I/O, and network snapshot."""
    return sm.get_full_snapshot()


@app.get("/system/processes")
async def api_system_processes(limit: int = 15):
    """Top processes by CPU usage."""
    return {"processes": sm.get_top_processes(limit=limit)}


# ---------------------------------------------------------------------------
# One-click full cleanup
# ---------------------------------------------------------------------------

class OneClickCleanupRequest(BaseModel):
    junk_session_id: Optional[int] = None
    delete_empty_folders: bool = True
    root_paths: list[str] = []


@app.post("/cleanup/one-click")
async def api_one_click_cleanup(req: OneClickCleanupRequest):
    """Perform safe automatic cleanup: junk files + empty folders."""
    report: dict = {"steps": [], "errors": []}

    # Step 1: Junk files
    try:
        sid = req.junk_session_id
        if sid is None:
            sid = await get_latest_session_id()
        junk_cats = scan_junk(sid or 0)
        all_ids = [c["id"] for c in junk_cats if c.get("exists") and c.get("size_bytes", 0) > 0]
        if all_ids:
            result = delete_junk_categories(all_ids)
            report["steps"].append({
                "step": "Junk Cleaner",
                "deleted": result.get("deleted", 0),
                "errors": result.get("errors", []),
            })
        else:
            report["steps"].append({"step": "Junk Cleaner", "deleted": 0, "errors": []})
    except Exception as exc:
        report["errors"].append(f"Junk clean failed: {exc}")

    # Step 2: Empty folders
    if req.delete_empty_folders and req.root_paths:
        try:
            empty = so.scan_empty_folders(req.root_paths)
            if empty:
                result = so.delete_empty_folders([f["path"] for f in empty])
                report["steps"].append({
                    "step": "Empty Folders",
                    "deleted": result.get("deleted", 0),
                    "errors": result.get("errors", []),
                })
            else:
                report["steps"].append({"step": "Empty Folders", "deleted": 0, "errors": []})
        except Exception as exc:
            report["errors"].append(f"Empty folder clean failed: {exc}")

    _cache.invalidate("dashboard")
    return report


# ---------------------------------------------------------------------------
# Report export
# ---------------------------------------------------------------------------

@app.get("/report/export")
async def api_export_report(session_id: Optional[int] = None):
    """Generate and return a self-contained HTML storage report."""
    html = await re_.generate_html_report(session_id=session_id)
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": "attachment; filename=storage-sense-report.html"},
    )


# ---------------------------------------------------------------------------
# Cache control
# ---------------------------------------------------------------------------

@app.post("/cache/invalidate")
async def api_invalidate_cache():
    """Manually invalidate all cached responses (called after scan completes)."""
    _cache.invalidate_all()
    return {"cleared": True}


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--background-scan", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    # ── File-based logging for packaged (PyInstaller) builds ─────────────────
    # When PyInstaller compiles with console=False, stdout/stderr are suppressed.
    # We redirect all logging to a file so startup errors can be diagnosed.
    log_dir = Path(
        os.getenv("LOCALAPPDATA", Path.home() / "AppData" / "Local")
    ) / "WindowsStorageSense"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "backend.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            # Only add StreamHandler if stdout is actually available
            *([] if getattr(sys, "frozen", False) else [logging.StreamHandler(sys.stdout)]),
        ],
    )
    logger = logging.getLogger("storageSense")
    logger.info("Backend starting — log: %s", log_file)

    if args.background_scan:
        # Called by Task Scheduler
        init_db()
        from scheduler import _run_background_scan
        _run_background_scan()
    else:
        import uvicorn
        uvicorn.run("main:app", host=args.host, port=args.port, reload=False)
