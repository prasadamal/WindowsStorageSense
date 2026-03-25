"""
Generate icon.ico and tray-icon.png for WindowsStorageSense.

Run from the repository root:
    python scripts/generate-icon.py

Requires Pillow (already in backend/requirements.txt):
    pip install Pillow
"""

import math
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

OUTPUT_DIR = Path(__file__).parent.parent / "frontend" / "public"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _draw_logo(size: int, bg: tuple, fg: tuple, accent: tuple) -> Image.Image:
    """Draw the StorageSense logo — a stylised HDD/shield shape."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(size * 0.08)
    r = int(size * 0.18)          # corner radius for rounded rect

    # Background rounded square
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=r, fill=bg)

    # Inner "drive" rectangle
    inner_pad = int(size * 0.22)
    drive_r = int(size * 0.10)
    draw.rounded_rectangle(
        [inner_pad, inner_pad, size - inner_pad, size - inner_pad],
        radius=drive_r,
        fill=fg,
    )

    # Three horizontal "platters" lines
    line_x0 = int(size * 0.32)
    line_x1 = int(size * 0.68)
    for i, frac in enumerate([0.38, 0.50, 0.62]):
        y = int(size * frac)
        lw = max(1, int(size * 0.04))
        draw.rectangle([line_x0, y - lw // 2, line_x1, y + lw // 2], fill=accent)

    # Small circle (spindle) — bottom-right of drive area
    cx = int(size * 0.67)
    cy = int(size * 0.67)
    cr = int(size * 0.07)
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=accent)

    return img


# Colour palette (dark navy background, white icon, blue accent)
BACKGROUND_COLOR = (15,  23, 42,  255)   # slate-900
FOREGROUND_COLOR = (30,  41, 59,  255)   # slate-800
ACCENT_COLOR     = (59, 130, 246, 255)   # brand-500 blue


# -------------------------------------------------------------------------
# icon.ico — multi-size ICO for the app window and taskbar
# -------------------------------------------------------------------------
ico_sizes = [16, 32, 48, 64, 128, 256]
ico_images = [_draw_logo(s, BACKGROUND_COLOR, FOREGROUND_COLOR, ACCENT_COLOR) for s in ico_sizes]
ico_path = OUTPUT_DIR / "icon.ico"
# Save as ICO with all sizes embedded
ico_images[0].save(
    ico_path,
    format="ICO",
    sizes=[(s, s) for s in ico_sizes],
    append_images=ico_images[1:],
)
print(f"✓ Written {ico_path}")

# -------------------------------------------------------------------------
# icon.png — 256×256 PNG (used by electron-builder for macOS/Linux)
# -------------------------------------------------------------------------
png_path = OUTPUT_DIR / "icon.png"
_draw_logo(256, BACKGROUND_COLOR, FOREGROUND_COLOR, ACCENT_COLOR).save(png_path, format="PNG")
print(f"✓ Written {png_path}")

# -------------------------------------------------------------------------
# tray-icon.png — 32×32 PNG for the system-tray
# -------------------------------------------------------------------------
tray_path = OUTPUT_DIR / "tray-icon.png"
_draw_logo(32, BACKGROUND_COLOR, FOREGROUND_COLOR, ACCENT_COLOR).save(tray_path, format="PNG")
print(f"✓ Written {tray_path}")

print("\nAll icons generated successfully.")
