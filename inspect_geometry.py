from collections import Counter
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PDF_PATH = ROOT / "data" / "source.pdf"
OUTPUT_PATH = ROOT / "outputs" / "page-2-curve-types.png"

PAGE_NUMBER = 2
RENDER_SCALE = 2

MIN_SIZE = 8
MAX_SIZE = 160
MIN_RATIO = 0.4
MAX_RATIO = 2.5

document = pymupdf.open(PDF_PATH)
page = document[PAGE_NUMBER - 1]

command_counts = Counter()
candidates = []

for path in page.get_drawings():
    is_closed = bool(path.get("closePath", False))

    for item in path["items"]:
        command = item[0]
        command_counts[command] += 1

        if command != "c":
            continue

        points = [
            value
            for value in item[1:]
            if isinstance(value, pymupdf.Point)
        ]

        if len(points) < 2:
            continue

        xs = [point.x for point in points]
        ys = [point.y for point in points]

        rect = pymupdf.Rect(
            min(xs),
            min(ys),
            max(xs),
            max(ys),
        )

        width = rect.width
        height = rect.height

        if width <= 0 or height <= 0:
            continue

        ratio = width / height

        if not (
            MIN_SIZE <= width <= MAX_SIZE
            and MIN_SIZE <= height <= MAX_SIZE
            and MIN_RATIO <= ratio <= MAX_RATIO
        ):
            continue

        candidates.append(
            {
                "rect": rect,
                "closed": is_closed,
            }
        )

print("Geometry commands:")

for command, count in command_counts.most_common():
    print(f"  {command}: {count}")

open_count = sum(not candidate["closed"] for candidate in candidates)
closed_count = sum(candidate["closed"] for candidate in candidates)

print()
print(f"Curve candidates: {len(candidates)}")
print(f"Open curve candidates: {open_count}")
print(f"Closed curve candidates: {closed_count}")

matrix = pymupdf.Matrix(RENDER_SCALE, RENDER_SCALE)
pixmap = page.get_pixmap(matrix=matrix, alpha=False)

image = Image.frombytes(
    "RGB",
    (pixmap.width, pixmap.height),
    pixmap.samples,
)

draw = ImageDraw.Draw(image)

for candidate in candidates:
    rect = candidate["rect"]

    pixel_box = (
        rect.x0 * RENDER_SCALE,
        rect.y0 * RENDER_SCALE,
        rect.x1 * RENDER_SCALE,
        rect.y1 * RENDER_SCALE,
    )

    # Red: open curve
    # Blue: curve belonging to a closed path
    color = (0, 80, 255) if candidate["closed"] else (255, 0, 0)

    draw.rectangle(
        pixel_box,
        outline=color,
        width=3,
    )

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT_PATH)

print(f"Saved preview: {OUTPUT_PATH}")