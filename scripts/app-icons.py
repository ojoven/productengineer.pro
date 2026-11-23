# Home screen icons: the brand hexagon in ink (#141412), never the light dark-mode variant
# of favicon.svg, so it stays visible on the white tile Android and iOS put behind it.
#
#   python3 scripts/app-icons.py
#
# Writes to public/:
#   icon-192.png, icon-512.png                    purpose "any": hexagon on transparent
#   icon-maskable-192.png, icon-maskable-512.png  purpose "maskable": hexagon inside the safe zone, on white
#   apple-touch-icon.png                          iOS, 180x180, opaque (iOS fills transparency with black)
# Needs Pillow.
import math
from pathlib import Path

from PIL import Image, ImageDraw

INK = (0x14, 0x14, 0x12, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)
SS = 8  # supersampling factor for smooth edges
OUT = Path(__file__).resolve().parent.parent / 'public'


def icon(size: int, height: float, background) -> Image.Image:
    """A pointy-top regular hexagon, `height` = vertex-to-vertex height as a share of the icon."""
    big = size * SS
    img = Image.new('RGBA', (big, big), background)
    r = height * big / 2
    c = big / 2
    points = [(c + r * math.cos(math.radians(a)), c + r * math.sin(math.radians(a))) for a in range(-90, 270, 60)]
    ImageDraw.Draw(img).polygon(points, fill=INK)
    return img.resize((size, size), Image.LANCZOS)


ICONS = {
    # Same proportions as logo.png.
    'icon-192.png': (192, 0.90, CLEAR),
    'icon-512.png': (512, 0.90, CLEAR),
    # Launchers crop maskable icons to a shape inside the central circle (radius 40%).
    # At 42% height the hexagon fills about 60% of what Android shows (the central two thirds).
    'icon-maskable-192.png': (192, 0.42, WHITE),
    'icon-maskable-512.png': (512, 0.42, WHITE),
    'apple-touch-icon.png': (180, 0.56, WHITE),
}

for name, (size, height, background) in ICONS.items():
    image = icon(size, height, background)
    if background == WHITE:
        image = image.convert('RGB')
    image.save(OUT / name, optimize=True)
    print(name, size)
