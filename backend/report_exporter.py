"""
Report exporter — generate a self-contained HTML analysis report.

The report includes:
  • Drive usage summary
  • Storage category breakdown
  • Top 20 largest files
  • Duplicate file summary
  • Junk categories
  • Smart recommendations

The output is a single-file HTML document that can be opened in any browser.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from database import get_connection
from scanner import list_drives, get_top_files, get_category_summary, get_latest_session_id
from junk_cleaner import scan_junk
from duplicate_finder import get_duplicate_groups


def _bytes_str(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.0f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def _pct_bar(pct: float, color: str = "#3b82f6") -> str:
    fill = min(100, max(0, pct))
    return (
        f'<div style="background:#1e293b;border-radius:4px;height:8px;overflow:hidden;margin-top:4px">'
        f'<div style="background:{color};height:100%;width:{fill:.1f}%;border-radius:4px;transition:width 0.5s"></div>'
        f'</div>'
    )


async def generate_html_report(session_id: Optional[int] = None) -> str:
    """Build and return the full HTML report as a string."""

    if session_id is None:
        session_id = await get_latest_session_id()

    drives = list_drives()
    top_files: list[dict] = []
    categories: list[dict] = []
    dupe_groups: list[dict] = []
    junk_cats: list[dict] = []

    if session_id is not None:
        top_files = await get_top_files(session_id, limit=20)
        categories = await get_category_summary(session_id)
        dupe_groups = get_duplicate_groups(session_id)
        junk_cats = [c for c in scan_junk(session_id) if c.get("exists") and c.get("size_bytes", 0) > 0]

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    total_junk = sum(c.get("size_bytes", 0) for c in junk_cats)
    total_dupe_wasted = sum(g.get("wasted_bytes", 0) for g in dupe_groups)

    # -------------------------------------------------------------------------
    # Build HTML sections
    # -------------------------------------------------------------------------

    def drive_rows() -> str:
        rows = ""
        for d in drives:
            pct = round(d.get("percent_used", 0), 1)
            color = "#ef4444" if pct > 90 else "#f59e0b" if pct > 70 else "#3b82f6"
            bar = _pct_bar(pct, color)
            rows += f"""
            <tr>
              <td><b>{d.get('label') or d.get('path')}</b></td>
              <td>{d.get('drive_type','?')}</td>
              <td>{_bytes_str(d.get('total_bytes',0))}</td>
              <td>{_bytes_str(d.get('used_bytes',0))}</td>
              <td>{_bytes_str(d.get('free_bytes',0))}</td>
              <td style="min-width:120px">{bar}<span style="font-size:11px;color:#94a3b8">{pct}%</span></td>
            </tr>"""
        return rows

    def category_rows() -> str:
        rows = ""
        for c in categories[:10]:
            rows += f"""
            <tr>
              <td>{c['category']}</td>
              <td>{c.get('file_count','?')}</td>
              <td><b>{_bytes_str(c.get('total_bytes',0))}</b></td>
            </tr>"""
        return rows

    def file_rows() -> str:
        rows = ""
        for f in top_files:
            rows += f"""
            <tr>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  title="{f.get('path','')}">
                {f.get('name','')}
              </td>
              <td>{f.get('category','?')}</td>
              <td><b>{_bytes_str(f.get('size_bytes',0))}</b></td>
              <td style="max-width:300px;font-size:11px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  title="{f.get('path','')}">
                {f.get('path','')}
              </td>
            </tr>"""
        return rows

    def dupe_rows() -> str:
        rows = ""
        for g in dupe_groups[:10]:
            rows += f"""
            <tr>
              <td>{g.get('file_count','?')} copies</td>
              <td>{_bytes_str(g.get('wasted_bytes',0))}</td>
              <td style="font-family:monospace;font-size:11px">{(g.get('full_hash','') or g.get('partial_hash',''))[:24]}…</td>
            </tr>"""
        return rows

    def junk_rows() -> str:
        rows = ""
        for c in junk_cats:
            rows += f"""
            <tr>
              <td>{c.get('label','?')}</td>
              <td><b>{_bytes_str(c.get('size_bytes',0))}</b></td>
            </tr>"""
        return rows

    recommendations: list[str] = []
    if total_junk > 500_000_000:
        recommendations.append(f"🗑️  {_bytes_str(total_junk)} of junk files detected — run Junk Cleaner to reclaim space.")
    if total_dupe_wasted > 200_000_000:
        recommendations.append(f"🔁  {_bytes_str(total_dupe_wasted)} wasted on duplicate files — use Duplicates finder to clean up.")
    for d in drives:
        if d.get("percent_used", 0) > 85:
            label = d.get("label") or d.get("path")
            recommendations.append(f"⚠️  Drive <b>{label}</b> is {d['percent_used']:.0f}% full — consider moving large files.")
    if not recommendations:
        recommendations.append("✅  No critical issues detected — your storage is in good shape!")

    rec_html = "".join(f'<li style="margin-bottom:6px">{r}</li>' for r in recommendations)

    # -------------------------------------------------------------------------
    # Assemble full HTML
    # -------------------------------------------------------------------------
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>StorageSense Report — {now_str}</title>
<style>
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  body {{ font-family:system-ui,-apple-system,sans-serif; background:#0f172a; color:#e2e8f0; padding:24px 32px; }}
  h1 {{ font-size:24px; font-weight:700; color:#fff; margin-bottom:4px; }}
  h2 {{ font-size:16px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em;
        margin:32px 0 12px; border-bottom:1px solid #1e293b; padding-bottom:6px; }}
  .meta {{ font-size:13px; color:#64748b; margin-bottom:24px; }}
  .stat-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:8px; }}
  .stat {{ background:#1e293b; border:1px solid #334155; border-radius:10px; padding:14px 16px; }}
  .stat-label {{ font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:.08em; }}
  .stat-value {{ font-size:22px; font-weight:700; color:#fff; margin-top:4px; }}
  .stat-sub {{ font-size:11px; color:#64748b; margin-top:2px; }}
  table {{ width:100%; border-collapse:collapse; margin-top:4px; }}
  th {{ text-align:left; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:.06em;
        padding:8px 10px; border-bottom:1px solid #1e293b; }}
  td {{ padding:8px 10px; font-size:13px; border-bottom:1px solid #1e293b40; vertical-align:middle; }}
  tr:hover td {{ background:#1e293b60; }}
  ul {{ list-style:none; padding-left:0; }}
  li {{ font-size:13px; padding:8px 12px; background:#1e293b; border-radius:8px; }}
  .footer {{ margin-top:40px; font-size:11px; color:#475569; text-align:center; }}
</style>
</head>
<body>
<h1>🗂 StorageSense Report</h1>
<p class="meta">Generated {now_str} · {len(drives)} drive(s) · Session #{session_id or 'N/A'}</p>

<div class="stat-grid">
  <div class="stat">
    <div class="stat-label">Drives</div>
    <div class="stat-value">{len(drives)}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Junk to clean</div>
    <div class="stat-value">{_bytes_str(total_junk)}</div>
    <div class="stat-sub">{len(junk_cats)} categories</div>
  </div>
  <div class="stat">
    <div class="stat-label">Duplicate waste</div>
    <div class="stat-value">{_bytes_str(total_dupe_wasted)}</div>
    <div class="stat-sub">{len(dupe_groups)} groups</div>
  </div>
  <div class="stat">
    <div class="stat-label">Files indexed</div>
    <div class="stat-value">{len(top_files)}+</div>
    <div class="stat-sub">in top list</div>
  </div>
</div>

<h2>Recommendations</h2>
<ul>{rec_html}</ul>

<h2>Drive Overview</h2>
<table>
  <tr><th>Drive</th><th>Type</th><th>Total</th><th>Used</th><th>Free</th><th>Usage</th></tr>
  {drive_rows()}
</table>

<h2>Storage by Category</h2>
<table>
  <tr><th>Category</th><th>Files</th><th>Size</th></tr>
  {category_rows() or '<tr><td colspan="3" style="color:#64748b">No scan data available</td></tr>'}
</table>

<h2>Top 20 Largest Files</h2>
<table>
  <tr><th>Name</th><th>Category</th><th>Size</th><th>Path</th></tr>
  {file_rows() or '<tr><td colspan="4" style="color:#64748b">No scan data available</td></tr>'}
</table>

<h2>Duplicate File Groups (Top 10)</h2>
<table>
  <tr><th>Copies</th><th>Wasted</th><th>Hash</th></tr>
  {dupe_rows() or '<tr><td colspan="3" style="color:#64748b">No duplicates found or no scan data</td></tr>'}
</table>

<h2>Junk Categories</h2>
<table>
  <tr><th>Category</th><th>Size</th></tr>
  {junk_rows() or '<tr><td colspan="2" style="color:#64748b">No junk found</td></tr>'}
</table>

<p class="footer">Generated by WindowsStorageSense · All data is local, nothing leaves your machine.</p>
</body>
</html>"""

    return html
