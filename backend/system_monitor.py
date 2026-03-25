"""
Real-time system monitor — CPU, RAM, disk I/O, network I/O, top processes.

All data is sampled live using psutil; no data leaves the machine.
"""

import os
import time
from pathlib import Path
from typing import Optional

import psutil


# ---------------------------------------------------------------------------
# CPU
# ---------------------------------------------------------------------------

def get_cpu_stats() -> dict:
    """Return per-core and overall CPU usage percentages."""
    per_core = psutil.cpu_percent(interval=0.2, percpu=True)
    overall = sum(per_core) / len(per_core) if per_core else 0
    freq = psutil.cpu_freq()
    return {
        "overall": round(overall, 1),
        "per_core": [round(p, 1) for p in per_core],
        "core_count": psutil.cpu_count(logical=True),
        "physical_cores": psutil.cpu_count(logical=False) or 1,
        "freq_mhz": round(freq.current, 0) if freq else None,
        "freq_max_mhz": round(freq.max, 0) if freq else None,
    }


# ---------------------------------------------------------------------------
# RAM
# ---------------------------------------------------------------------------

def get_ram_stats() -> dict:
    """Return RAM and swap usage."""
    vm = psutil.virtual_memory()
    sw = psutil.swap_memory()
    return {
        "total": vm.total,
        "used": vm.used,
        "available": vm.available,
        "percent": round(vm.percent, 1),
        "swap_total": sw.total,
        "swap_used": sw.used,
        "swap_percent": round(sw.percent, 1),
    }


# ---------------------------------------------------------------------------
# Disk I/O
# ---------------------------------------------------------------------------

# Track previous I/O counters for delta calculation
_prev_disk_io: Optional[dict] = None
_prev_disk_ts: float = 0.0


def get_disk_io_stats() -> dict:
    """Return per-disk read/write bytes per second."""
    global _prev_disk_io, _prev_disk_ts

    now = time.monotonic()
    try:
        counters = psutil.disk_io_counters(perdisk=True)
    except Exception:
        return {"disks": [], "total_read_bps": 0, "total_write_bps": 0}

    result = []
    total_read_bps = 0.0
    total_write_bps = 0.0

    elapsed = now - _prev_disk_ts if _prev_disk_ts else 1.0

    for disk_name, c in counters.items():
        prev = (_prev_disk_io or {}).get(disk_name)
        if prev and elapsed > 0:
            read_bps = max(0, (c.read_bytes - prev.read_bytes) / elapsed)
            write_bps = max(0, (c.write_bytes - prev.write_bytes) / elapsed)
        else:
            read_bps = 0.0
            write_bps = 0.0
        total_read_bps += read_bps
        total_write_bps += write_bps
        result.append({
            "disk": disk_name,
            "read_bps": round(read_bps),
            "write_bps": round(write_bps),
            "read_total": c.read_bytes,
            "write_total": c.write_bytes,
        })

    _prev_disk_io = counters
    _prev_disk_ts = now

    return {
        "disks": result,
        "total_read_bps": round(total_read_bps),
        "total_write_bps": round(total_write_bps),
    }


# ---------------------------------------------------------------------------
# Network I/O
# ---------------------------------------------------------------------------

_prev_net_io: Optional[object] = None
_prev_net_ts: float = 0.0


def get_network_stats() -> dict:
    """Return network sent/received bytes per second."""
    global _prev_net_io, _prev_net_ts

    now = time.monotonic()
    try:
        counters = psutil.net_io_counters()
    except Exception:
        return {"sent_bps": 0, "recv_bps": 0}

    elapsed = now - _prev_net_ts if _prev_net_ts else 1.0
    if _prev_net_io and elapsed > 0:
        sent_bps = max(0, (counters.bytes_sent - _prev_net_io.bytes_sent) / elapsed)
        recv_bps = max(0, (counters.bytes_recv - _prev_net_io.bytes_recv) / elapsed)
    else:
        sent_bps = 0.0
        recv_bps = 0.0

    _prev_net_io = counters
    _prev_net_ts = now

    return {
        "sent_bps": round(sent_bps),
        "recv_bps": round(recv_bps),
        "total_sent": counters.bytes_sent,
        "total_recv": counters.bytes_recv,
    }


# ---------------------------------------------------------------------------
# Top processes
# ---------------------------------------------------------------------------

def get_top_processes(limit: int = 15) -> list[dict]:
    """Return processes sorted by CPU usage (descending)."""
    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info", "status"]):
        try:
            info = p.info
            mem = info.get("memory_info")
            procs.append({
                "pid": info["pid"],
                "name": info.get("name", ""),
                "cpu_percent": round(info.get("cpu_percent") or 0, 1),
                "memory_bytes": mem.rss if mem else 0,
                "status": info.get("status", ""),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    procs.sort(key=lambda x: x["cpu_percent"], reverse=True)
    return procs[:limit]


# ---------------------------------------------------------------------------
# Aggregated snapshot
# ---------------------------------------------------------------------------

def get_full_snapshot() -> dict:
    """Return a combined snapshot of all system metrics."""
    return {
        "cpu": get_cpu_stats(),
        "ram": get_ram_stats(),
        "disk_io": get_disk_io_stats(),
        "network": get_network_stats(),
        "processes": get_top_processes(limit=10),
    }
