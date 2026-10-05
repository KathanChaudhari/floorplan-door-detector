from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PDF_PATH = ROOT / "data" / "source.pdf"
OUTPUT_PATH = ROOT / "outputs" / "page-2-arc-candidates.png"

# Human page number. Page 1 is ignored as requested.
PAGE_NUMBER = 2

# Door swing arcs on architectural sheets are usually nearly square.
MIN_SIZE = 10
MAX_SIZE = 100
MIN_RATIO = 0.65
MAX_RATIO = 1.55

# Higher values produce a clearer but larger output image.
RENDER_SCALE = 2

if not PDF_PATH.exists():
    raise FileNotFoundError(f"PDF not found: {PDF_PATH}")

document = pymupdf.open(PDF_PATH)
page = document[PAGE_NUMBER - 1]

candidates = []

for path in page.get_drawings():
    # Door swing arcs should normally be open paths.
    if path.get("closePath", False):
        continue

    for item in path["items"]:
        command = item[0]

        # "c" means a cubic Bezier curve.
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
                "width": path.get("width"),
                "color": path.get("color"),
            }
        )

print(f"Page size: {page.rect.width:.1f} × {page.rect.height:.1f}")
print(f"Arc candidates: {len(candidates)}")

matrix = pymupdf.Matrix(RENDER_SCALE, RENDER_SCALE)
pixmap = page.get_pixmap(matrix=matrix, alpha=False)

image = Image.frombytes(
    "RGB",
    (pixmap.width, pixmap.height),
    pixmap.samples,
)

draw = ImageDraw.Draw(image)

for index, candidate in enumerate(candidates, start=1):
    rect = candidate["rect"]

    pixel_box = (
        rect.x0 * RENDER_SCALE,
        rect.y0 * RENDER_SCALE,
        rect.x1 * RENDER_SCALE,
        rect.y1 * RENDER_SCALE,
    )

    draw.rectangle(
        pixel_box,
        outline=(255, 0, 0),
        width=3,
    )

    draw.text(
        (pixel_box[0], pixel_box[1] - 12),
        str(index),
        fill=(255, 0, 0),
    )

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT_PATH)

print(f"Saved preview: {OUTPUT_PATH}")