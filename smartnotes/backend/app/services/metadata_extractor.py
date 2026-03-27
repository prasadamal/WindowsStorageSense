"""
Metadata extractor service.

Fetches Open Graph, Twitter Card, and YouTube oEmbed metadata from a URL
so every saved link has a rich preview card (title, description, thumbnail).

Design:
- YouTube URLs → YouTube oEmbed API (no API key needed for basic data)
- All other URLs → HTTP GET + BeautifulSoup Open Graph / meta tag parsing

Falls back gracefully — a missing or broken page still returns a partial result.
"""

import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings

settings = get_settings()

# ── YouTube helpers ──────────────────────────────────────────────────────────

_YT_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?v=|youtu\.be/)([A-Za-z0-9_-]{11})"),
]
_YT_OEMBED = "https://www.youtube.com/oembed?url={url}&format=json"


def _youtube_video_id(url: str) -> str | None:
    for pat in _YT_PATTERNS:
        m = pat.search(url)
        if m:
            return m.group(1)
    return None


# ── Platform detection ────────────────────────────────────────────────────────

def _host_is(host: str, domain: str) -> bool:
    """
    Return True only when *host* is exactly *domain* or a direct subdomain.

    This prevents substring-based bypass (e.g. "fakeyoutube.com" no longer
    matches "youtube.com").
    """
    return host == domain or host.endswith("." + domain)


def detect_platform(url: str) -> str:
    """Identify the source platform from a URL's hostname."""
    # Strip port if present
    host = urlparse(url).hostname or ""
    host = host.lower()
    if _host_is(host, "youtube.com") or _host_is(host, "youtu.be"):
        return "youtube"
    if _host_is(host, "instagram.com"):
        return "instagram"
    if _host_is(host, "twitter.com") or _host_is(host, "x.com"):
        return "twitter"
    if _host_is(host, "google.com") or _host_is(host, "maps.google.com") or _host_is(host, "goo.gl"):
        return "maps"
    if _host_is(host, "tiktok.com"):
        return "tiktok"
    if _host_is(host, "reddit.com"):
        return "reddit"
    return "web"


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class LinkMetadata:
    title: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    source_platform: str = "web"
    author: str | None = None


# ── Core extraction logic ─────────────────────────────────────────────────────

async def extract_metadata(url: str) -> LinkMetadata:
    """
    Async: fetch and parse metadata for the given URL.
    Returns a LinkMetadata dataclass — never raises.
    """
    platform = detect_platform(url)
    meta = LinkMetadata(source_platform=platform)

    try:
        if platform == "youtube":
            await _fetch_youtube(url, meta)
        else:
            await _fetch_opengraph(url, meta)
    except Exception:
        # Graceful degradation — caller still gets partial meta
        pass

    return meta


async def _fetch_youtube(url: str, meta: LinkMetadata) -> None:
    oembed_url = _YT_OEMBED.format(url=url)
    async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
        resp = await client.get(oembed_url)
        resp.raise_for_status()
        data = resp.json()

    meta.title = data.get("title")
    meta.author = data.get("author_name")
    meta.thumbnail_url = data.get("thumbnail_url")

    # High-res thumbnail
    vid = _youtube_video_id(url)
    if vid:
        meta.thumbnail_url = f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"


async def _fetch_opengraph(url: str, meta: LinkMetadata) -> None:
    """Parse Open Graph / Twitter Card meta tags from the raw HTML."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; SmartNotes/1.0; +https://smartnotes.app)"
        )
    }
    async with httpx.AsyncClient(
        timeout=settings.REQUEST_TIMEOUT_SECONDS,
        follow_redirects=True,
    ) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()

    # Limit parse size to avoid parsing huge pages
    content = resp.text[: settings.MAX_CONTENT_LENGTH]

    # Simple regex-based OG tag extraction (no external HTML parser dep)
    def _og(prop: str) -> str | None:
        m = re.search(
            rf'<meta[^>]+(?:property|name)=["\'](?:og:|twitter:)?{re.escape(prop)}["\'][^>]+content=["\']([^"\']+)["\']',
            content,
            re.IGNORECASE,
        ) or re.search(
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:|twitter:)?{re.escape(prop)}["\']',
            content,
            re.IGNORECASE,
        )
        return m.group(1).strip() if m else None

    def _title() -> str | None:
        t = _og("title")
        if t:
            return t
        m = re.search(r"<title[^>]*>([^<]+)</title>", content, re.IGNORECASE)
        return m.group(1).strip() if m else None

    meta.title = _title()
    meta.description = _og("description")
    meta.thumbnail_url = _og("image")
