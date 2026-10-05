from collections import Counter
from math import hypot
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PDF_PATH = ROOT / "data" / "source.pdf"
OUTPUT_PATH = ROOT / "outputs" / "page-2-line-segments.png"

PAGE_NUMBER = 2
RENDER_SCALE = 2

document = pymupdf.open(PDF_PATH)
page = document[PAGE_NUMBER - 1]

matrix = pymupdf.Matrix(RENDER_SCALE, RENDER_SCALE)
pixmap = page.get_pixmap(matrix=matrix, alpha=False)

image = Image.frombytes(
    "RGB",
    (pixmap.width, pixmap.height),
    pixmap.samples,
)

draw = ImageDraw.Draw(image)
length_counts = Counter()

for path in page.get_drawings():
    for item in path["items"]:
        if item[0] != "l":
            continue

        start = item[1]
        end = item[2]

        length = hypot(
            end.x - start.x,
            end.y - start.y,
        )

        if length < 1:
            bucket = "<1"
            color = (255, 0, 255)       # Magenta
        elif length < 2:
            bucket = "1-2"
            color = (255, 0, 0)         # Red
        elif length < 5:
            bucket = "2-5"
            color = (255, 100, 0)       # Orange
        elif length < 10:
            bucket = "5-10"
            color = (0, 180, 0)         # Green
        elif length < 20:
            bucket = "10-20"
            color = (0, 100, 255)       # Blue
        elif length < 50:
            bucket = "20-50"
            color = None
        else:
            bucket = "50+"
            color = None

        length_counts[bucket] += 1

        # Draw only short line segments.
        if color is None:
            continue

        draw.line(
            (
                start.x * RENDER_SCALE,
                start.y * RENDER_SCALE,
                end.x * RENDER_SCALE,
                end.y * RENDER_SCALE,
            ),
            fill=color,
            width=3,
        )

print("Line-segment lengths:")

for bucket in ["<1", "1-2", "2-5", "5-10", "10-20", "20-50", "50+"]:
    print(f"  {bucket}: {length_counts[bucket]}")

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT_PATH)

print(f"Saved preview: {OUTPUT_PATH}")