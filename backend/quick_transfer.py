"""
Quick Transfer — zero-config LAN file sharing.

Starts a temporary HTTP server on the local network so that any device
on the same Wi-Fi / LAN can browse and download the shared files via a
browser.  The share is protected by a short random token embedded in the
URL so it is not publicly discoverable.
"""

import os
import socket
import threading
import pathlib
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import quote, unquote

# ---------------------------------------------------------------------------
# Global state (one active share at a time)
# ---------------------------------------------------------------------------

_server: HTTPServer | None = None
_server_thread: threading.Thread | None = None
_token: str = ""
_shared_files: list[str] = []


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class _ShareHandler(BaseHTTPRequestHandler):
    """Minimal HTTP handler that serves shared files."""

    def log_message(self, fmt, *args):
        pass  # Suppress access logs from the console

    def do_GET(self):
        path = self.path.lstrip("/")

        # Root: index page listing all files
        if path == "" or path == _token:
            self._serve_index()
            return

        # File download: /<token>/<filename>
        parts = path.split("/", 1)
        if len(parts) == 2 and parts[0] == _token:
            filename = unquote(parts[1])
            self._serve_file(filename)
            return

        self.send_error(404)

    # ------------------------------------------------------------------

    def _serve_index(self):
        items = ""
        for file_path in _shared_files:
            name = pathlib.Path(file_path).name
            try:
                size = os.path.getsize(file_path)
            except OSError:
                size = 0
            items += (
                f'<li><a href="/{_token}/{quote(name)}">{name}</a>'
                f' <span style="color:#888">({_human(size)})</span></li>\n'
            )

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>StorageSense · Quick Transfer</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 540px;
            margin: 48px auto; padding: 0 16px; color: #e2e8f0;
            background: #0f172a; }}
    h1   {{ font-size: 1.4rem; margin-bottom: 0.25rem; }}
    p    {{ color: #94a3b8; font-size: .9rem; }}
    ul   {{ list-style: none; padding: 0; }}
    li   {{ padding: 10px 0; border-bottom: 1px solid #1e293b; }}
    a    {{ color: #818cf8; text-decoration: none; font-weight: 500; }}
    a:hover {{ text-decoration: underline; }}
    footer {{ margin-top: 2rem; font-size: .75rem; color: #475569; }}
  </style>
</head>
<body>
  <h1>📁 StorageSense Quick Transfer</h1>
  <p>Tap a file to download it to your device.</p>
  <ul>{items}</ul>
  <footer>This share is temporary and will stop when the sender closes it.</footer>
</body>
</html>"""
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, filename: str):
        # Find matching path in shared list
        for file_path in _shared_files:
            if pathlib.Path(file_path).name == filename:
                try:
                    size = os.path.getsize(file_path)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/octet-stream")
                    self.send_header(
                        "Content-Disposition",
                        f'attachment; filename="{filename}"',
                    )
                    self.send_header("Content-Length", str(size))
                    self.end_headers()
                    with open(file_path, "rb") as fh:
                        while chunk := fh.read(1024 * 1024):  # 1 MB chunks
                            self.wfile.write(chunk)
                except Exception:
                    self.send_error(500)
                return
        self.send_error(404)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def _get_local_ip() -> str:
    """Best-effort local LAN IP address."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def start_share(file_paths: list[str], port: int = 0) -> dict:
    """
    Start sharing the given files over HTTP.

    Parameters
    ----------
    file_paths : list of absolute paths to share (must be files, not dirs)
    port       : TCP port (0 = let the OS pick a free port)

    Returns a dict with url, token, ip, port, and the list of file names.
    """
    global _server, _server_thread, _token, _shared_files

    # Stop any existing share first
    stop_share()

    valid = [p for p in file_paths if os.path.isfile(p)]
    if not valid:
        return {"error": "No valid files to share"}

    _token = str(uuid.uuid4())[:8]
    _shared_files = valid

    srv = HTTPServer(("0.0.0.0", port), _ShareHandler)
    actual_port = srv.server_address[1]
    _server = srv

    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    _server_thread = t

    local_ip = _get_local_ip()
    url = f"http://{local_ip}:{actual_port}/{_token}"
    return {
        "url": url,
        "token": _token,
        "ip": local_ip,
        "port": actual_port,
        "files": [pathlib.Path(p).name for p in _shared_files],
    }


def stop_share() -> dict:
    """Stop the active share server."""
    global _server, _server_thread, _token, _shared_files
    if _server is not None:
        _server.shutdown()
        _server = None
    _server_thread = None
    _token = ""
    _shared_files = []
    return {"stopped": True}


def get_share_status() -> dict:
    """Return the current sharing status."""
    if _server is None:
        return {"active": False}
    ip = _get_local_ip()
    port = _server.server_address[1]
    return {
        "active": True,
        "url": f"http://{ip}:{port}/{_token}",
        "ip": ip,
        "port": port,
        "files": [pathlib.Path(p).name for p in _shared_files],
    }
