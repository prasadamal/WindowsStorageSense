"""
Tag extraction service.

Pipeline:
1. Rule-based extraction using curated entity dictionaries (cities, cuisines,
   activities, moods) — fast, zero-cost, works offline.
2. Optional OpenAI GPT extraction — richer, context-aware, enabled when
   OPENAI_API_KEY is set in configuration.

Returns a list of (name, category) tuples ready to be persisted as Tags.
"""

import json
import re
from typing import NamedTuple

from app.core.config import get_settings

settings = get_settings()


class ExtractedTag(NamedTuple):
    name: str
    category: str  # place | cuisine | activity | mood | topic | person


# ── Entity dictionaries ───────────────────────────────────────────────────────
# These are compact starting sets — extend or replace with a proper NER model
# in production.

_INDIAN_CITIES = {
    "bangalore", "bengaluru", "mumbai", "delhi", "chennai", "hyderabad",
    "pune", "kolkata", "ahmedabad", "jaipur", "surat", "lucknow", "kanpur",
    "nagpur", "indore", "thane", "bhopal", "patna", "vadodara", "goa",
    "kochi", "coimbatore", "mysore", "mysuru", "visakhapatnam", "vizag",
    "agra", "varanasi", "meerut", "rajkot", "srinagar", "amritsar",
    "aurangabad", "noida", "gurgaon", "gurugram", "chandigarh",
}

_WORLD_CITIES = {
    "london", "paris", "new york", "nyc", "tokyo", "sydney", "dubai",
    "singapore", "bangkok", "amsterdam", "berlin", "rome", "barcelona",
    "istanbul", "toronto", "los angeles", "san francisco", "chicago",
    "bali", "phuket", "hong kong", "seoul", "taipei",
}

_ALL_PLACES = _INDIAN_CITIES | _WORLD_CITIES

_CUISINES = {
    "south indian", "north indian", "chinese", "italian", "mexican",
    "thai", "japanese", "korean", "mediterranean", "middle eastern",
    "street food", "biryani", "pizza", "sushi", "ramen", "tacos",
    "burger", "seafood", "vegan", "vegetarian", "bbq", "grills",
    "continental", "french", "spanish", "turkish", "lebanese",
}

_ACTIVITIES = {
    "cafe", "coffee", "restaurant", "bar", "pub", "nightclub", "club",
    "museum", "gallery", "park", "beach", "trekking", "hiking", "camping",
    "shopping", "market", "spa", "hotel", "resort", "temple", "church",
    "mosque", "monument", "waterfall", "lake", "fort", "palace",
    "brewery", "rooftop", "brunch", "buffet", "food tour",
}

_MOODS = {
    "date night", "romantic", "family", "budget", "luxury", "solo",
    "friends", "group", "weekend", "quick bite", "late night",
    "hidden gem", "must visit", "overrated", "underrated",
}


# ── Rule-based extractor ──────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    return text.lower().strip()


def _find_in_text(text: str, dictionary: set[str]) -> list[str]:
    norm = _normalize(text)
    found = []
    for term in dictionary:
        # whole-word match to avoid partial hits
        if re.search(r"\b" + re.escape(term) + r"\b", norm):
            found.append(term)
    return found


def extract_tags_rule_based(title: str, description: str, body: str) -> list[ExtractedTag]:
    combined = f"{title or ''} {description or ''} {body or ''}"
    tags: list[ExtractedTag] = []

    for place in _find_in_text(combined, _ALL_PLACES):
        tags.append(ExtractedTag(name=place.title(), category="place"))
    for cuisine in _find_in_text(combined, _CUISINES):
        tags.append(ExtractedTag(name=cuisine.title(), category="cuisine"))
    for activity in _find_in_text(combined, _ACTIVITIES):
        tags.append(ExtractedTag(name=activity.title(), category="activity"))
    for mood in _find_in_text(combined, _MOODS):
        tags.append(ExtractedTag(name=mood.title(), category="mood"))

    # Deduplicate preserving order
    seen: set[str] = set()
    unique: list[ExtractedTag] = []
    for t in tags:
        key = t.name.lower()
        if key not in seen:
            seen.add(key)
            unique.append(t)
    return unique


# ── OpenAI extractor (optional) ───────────────────────────────────────────────

_SYSTEM_PROMPT = """
You are a tag extraction assistant for a smart notes app.
Given a note's title, description, and body, extract relevant tags.
Return ONLY a JSON array of objects, each with "name" (string) and "category"
(one of: place, cuisine, activity, mood, topic, person).
Extract at most 10 tags. Example:
[{"name": "Bangalore", "category": "place"}, {"name": "Cafe", "category": "activity"}]
"""


async def extract_tags_openai(
    title: str, description: str, body: str
) -> list[ExtractedTag]:
    """Use GPT to extract richer contextual tags. Falls back to [] on error."""
    if not settings.OPENAI_API_KEY:
        return []

    try:
        import openai  # optional dependency

        client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        user_content = (
            f"Title: {title or 'N/A'}\n"
            f"Description: {description or 'N/A'}\n"
            f"Body: {body or 'N/A'}"
        )
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
            max_tokens=256,
        )
        raw = response.choices[0].message.content or "[]"
        items = json.loads(raw)
        return [
            ExtractedTag(name=i["name"], category=i.get("category", "topic"))
            for i in items
            if isinstance(i, dict) and "name" in i
        ]
    except Exception:
        return []


# ── Public entry point ────────────────────────────────────────────────────────

async def extract_tags(
    title: str | None,
    description: str | None,
    body: str | None,
) -> list[ExtractedTag]:
    """
    Extract tags using the best available method.
    If OpenAI is configured its results take precedence; otherwise falls back
    to the fast rule-based extractor.
    """
    t = title or ""
    d = description or ""
    b = body or ""

    if settings.OPENAI_API_KEY:
        ai_tags = await extract_tags_openai(t, d, b)
        if ai_tags:
            return ai_tags

    return extract_tags_rule_based(t, d, b)
