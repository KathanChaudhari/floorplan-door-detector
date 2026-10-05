from pathlib import Path
import pymupdf
import fitz

ROOT = Path(__file__).resolve().parent
PDF_PATH = ROOT / "data" / "source.pdf"

if not PDF_PATH.exists():
    raise FileNotFoundError(f"PDF not found: {PDF_PATH}")

document = pymupdf.open(PDF_PATH)

print(f"PDF: {PDF_PATH.name}")
print(f"Pages: {len(document)}")
print()

for page_index, page in enumerate(document):
    drawings = page.get_drawings()
    images = page.get_images(full=True)
    words = page.get_text("words")

    print(
        f"Page {page_index + 1}: "
        f"vector paths={len(drawings)}, "
        f"embedded images={len(images)}, "
        f"text words={len(words)}"
    )