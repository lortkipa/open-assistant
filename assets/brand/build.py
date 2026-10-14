"""Generate every Open Assistant brand asset from one definition of the mark.

Usage: python3 assets/brand/build.py
Needs: Python 3 with fonttools (pip install fonttools), rsvg-convert (librsvg) and ImageMagick.
The wordmark font (Schibsted Grotesk, OFL) is downloaded once into .cache/ next to this script.
"""
import os, subprocess, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = HERE
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/schibstedgrotesk/SchibstedGrotesk%5Bwght%5D.ttf"
FONT = os.path.join(HERE, ".cache", "SchibstedGrotesk[wght].ttf")
os.makedirs(f"{OUT}/png", exist_ok=True)

INK, ORANGE, PAPER = "#151515", "#FF4D1A", "#F2F1EC"
INK_DARK, ORANGE_DARK, NIGHT = "#F2F2EF", "#FF5C2E", "#121215"

CURSOR = "M0 0L0 22L5.9 16.6L9.9 25.5L13.5 23.9L9.6 15.1L17.2 15.1Z"


def mark(user, agent):
    """The mark in a 64x64 box: user's pointer (top-left) and agent's pointer (bottom-right) meet tip to tip."""
    s = 'stroke-width="2.6" stroke-linejoin="round"'
    return (
        f'<path d="{CURSOR}" transform="translate(30.5 30.5) rotate(180) scale(1.12)" fill="{user}" stroke="{user}" {s}/>'
        f'<path d="{CURSOR}" transform="translate(33.5 33.5) scale(1.12)" fill="{agent}" stroke="{agent}" {s}/>'
    )


def svg(w, h, body, vb=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb or f"0 0 {w} {h}"}" width="{w}" height="{h}">{body}</svg>\n'


def write(name, text):
    with open(f"{OUT}/{name}", "w") as f:
        f.write(text)


# Marks
write("mark.svg", svg(64, 64, mark(INK, ORANGE)))
write("mark-on-dark.svg", svg(64, 64, mark(INK_DARK, ORANGE_DARK)))
write("mark-mono.svg", svg(64, 64, f'<g fill="currentColor">{mark("currentColor", "currentColor")}</g>'))


# App icons: full-bleed square (platforms apply their own mask) and a rounded favicon tile
def tile(bg, radius, user, agent, scale=0.64):
    off = 32 * (1 - scale)
    return (
        f'<rect width="64" height="64" rx="{radius}" fill="{bg}"/>'
        f'<g transform="translate({off:.2f} {off:.2f}) scale({scale})">{mark(user, agent)}</g>'
    )


write("app-icon.svg", svg(1024, 1024, tile(PAPER, 0, INK, ORANGE), "0 0 64 64"))
write("app-icon-dark.svg", svg(1024, 1024, tile(NIGHT, 0, INK_DARK, ORANGE_DARK), "0 0 64 64"))
# Android adaptive foreground: mark inside the 66% safe zone, transparent background
write("app-icon-foreground.svg", svg(1024, 1024, f'<g transform="translate(12.8 12.8) scale(0.6)">{mark(INK, ORANGE)}</g>', "0 0 64 64"))
# Favicon: larger mark so it holds up at 16px
write("favicon.svg", svg(64, 64, tile(PAPER, 12, INK, ORANGE, scale=0.94)))


# Wordmark: "open assistant" in Schibsted Grotesk Bold, outlined to paths
if not os.path.exists(FONT):
    os.makedirs(os.path.dirname(FONT), exist_ok=True)
    urllib.request.urlretrieve(FONT_URL, FONT)
font = TTFont(FONT)
font = instantiateVariableFont(font, {"wght": 700})
gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
upm = font["head"].unitsPerEm
xh = font["OS/2"].sxHeight

TEXT, SIZE, TRACK = "open assistant", 36, -0.02
k = SIZE / upm
baseline = 32 + xh * k / 2  # centre the x-height on the mark's centre
x0 = 64  # mark ink spans x 10..54; gap before text


def word_paths(color, x_start):
    pen = SVGPathPen(gs)
    x = x_start
    for ch in TEXT:
        g = cmap[ord(ch)]
        tp = TransformPen(pen, (k, 0, 0, -k, x, baseline))
        gs[g].draw(tp)
        x += hmtx[g][0] * k + TRACK * SIZE
    return f'<path fill="{color}" d="{pen.getCommands()}"/>', x - TRACK * SIZE


_, end = word_paths(INK, x0)
W = round(end + 2)
for name, (u, a, txt) in {
    "lockup.svg": (INK, ORANGE, INK),
    "lockup-on-dark.svg": (INK_DARK, ORANGE_DARK, INK_DARK),
}.items():
    p, _ = word_paths(txt, x0)
    write(name, svg(W - 9, 64, mark(u, a) + p, f"9 0 {W - 9} 64"))
p, _ = word_paths(INK, 0)
write("wordmark.svg", svg(round(end - x0 + 2), 64, p))


# PNG exports
def png(src, size, dst):
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), f"{OUT}/{src}", "-o", f"{OUT}/png/{dst}"], check=True)


for s in (1024, 512, 192):
    png("app-icon.svg", s, f"app-icon-{s}.png")
png("app-icon.svg", 180, "apple-touch-icon.png")
png("app-icon-foreground.svg", 1024, "app-icon-foreground-1024.png")
for s in (16, 32, 48):
    png("favicon.svg", s, f"favicon-{s}.png")
subprocess.run(["magick", *(f"{OUT}/png/favicon-{s}.png" for s in (16, 32, 48)), f"{OUT}/favicon.ico"], check=True)
subprocess.run(["rsvg-convert", "-h", "256", f"{OUT}/lockup.svg", "-o", f"{OUT}/png/lockup.png"], check=True)
subprocess.run(["rsvg-convert", "-h", "256", f"{OUT}/lockup-on-dark.svg", "-o", f"{OUT}/png/lockup-on-dark.png"], check=True)
print(f"Wrote brand assets to {OUT}")
