#!/usr/bin/env python3
"""Render original floor-plan pages for annotation; does not detect doors.

Install: python -m pip install pypdfium2 Pillow
Example:
    python prepare_door_images.py --pdf data/source.pdf --project project_001 \
        --pages 2-8 --out data/prepared/project_001

Output is lossless PNG plus a page manifest. No labels are fabricated, no
training splits are made, and the source PDF is never modified. Keep each
construction project in only one train/validation/test split before tiling.
"""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import pypdfium2 as pdfium


def parse_pages(spec, page_count):
    selected = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            raise ValueError("Empty page selection.")
        ends = part.split("-")
        if len(ends) == 1:
            selected.add(int(ends[0]))
        elif len(ends) == 2:
            first, last = map(int, ends)
            if last < first:
                raise ValueError("Page range must run from low to high.")
            selected.update(range(first, last + 1))
        else:
            raise ValueError("Use page numbers like 2-8 or 2,4,6.")
    if not selected or min(selected) < 1 or max(selected) > page_count:
        raise ValueError(f"Page numbers must be between 1 and {page_count}.")
    return sorted(selected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--project", required=True, help="Stable project ID")
    parser.add_argument("--pages", help="1-based numbers, e.g. 2-8 or 2,4")
    parser.add_argument("--dpi", type=int, default=150)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    if not args.pdf.is_file():
        parser.error(f"PDF not found: {args.pdf}")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", args.project):
        parser.error("Use only letters, numbers, underscores or hyphens in --project.")
    if not 72 <= args.dpi <= 300:
        parser.error("Choose a DPI between 72 and 300.")
    if args.out.exists() and (not args.out.is_dir() or any(args.out.iterdir())):
        parser.error("Output already exists and is not empty. Choose a new --out path.")

    document = pdfium.PdfDocument(str(args.pdf))
    try:
        page_count = len(document)
        default_pages = f"2-{page_count}" if page_count >= 2 else "1"
        try:
            page_numbers = parse_pages(args.pages or default_pages, page_count)
        except ValueError as exc:
            parser.error(str(exc))
        args.out.mkdir(parents=True, exist_ok=True)
        pages_dir = args.out / "pages"
        pages_dir.mkdir()
        digest = hashlib.sha256()
        with args.pdf.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        manifest = {
            "project_id": args.project,
            "source_filename": args.pdf.name,
            "source_sha256": digest.hexdigest(),
            "source_page_count": page_count,
            "dpi": args.dpi,
            "split": "unassigned",
            "warning": "Images are unlabelled. Split by project before tiling or augmentation.",
            "pages": [],
        }
        print(f"PDF pages: {page_count}")
        print(f"Selected pages: {', '.join(map(str, page_numbers))}")
        for number in page_numbers:
            page = document[number - 1]
            bitmap = None
            image = None
            try:
                bitmap = page.render(scale=args.dpi / 72)
                image = bitmap.to_pil()
                relative = Path("pages") / f"{args.project}_page_{number:03d}.png"
                image.save(args.out / relative, format="PNG")
                manifest["pages"].append({
                    "page_number": number,
                    "image": relative.as_posix(),
                    "image_width": image.width,
                    "image_height": image.height,
                    "pdf_page_size": list(page.get_size()),
                    "pdf_page_rotation_degrees": page.get_rotation(),
                })
                print(f"Saved {relative.name}: {image.width} x {image.height}")
            finally:
                if image is not None:
                    image.close()
                if bitmap is not None:
                    bitmap.close()
                page.close()
        (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"\nPrepared {len(page_numbers)} original page images.")
        print(f"Open: {pages_dir.resolve()}")
        print("Next: annotate doors on these originals. Do not train on blue-box previews.")
    finally:
        document.close()


if __name__ == "__main__":
    try:
        main()
    except (OSError, pdfium.PdfiumError) as exc:
        print(f"Preparation failed: {exc}", file=sys.stderr)
        sys.exit(1)
