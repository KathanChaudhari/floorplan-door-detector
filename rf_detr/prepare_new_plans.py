from pathlib import Path
import pymupdf

DPI = 150
PDF_DIR = Path("data/pdfs")
OUT_DIR = Path("data/prepared")

jobs = [
    # PDF filename, project name, [(PDF page number, output name)]
    (
        "Greenville FP-1.pdf",
        "greenville",
        [(1, "greenville_page_001.png")],
    ),
    (
        "GVHC Stockton FP.pdf",
        "gvhc_stockton",
        [
            (2, "gvhc_stockton_area_a.png"),
            (3, "gvhc_stockton_area_b.png"),
            (4, "gvhc_stockton_area_c.png"),
            (5, "gvhc_stockton_area_d.png"),
        ],
    ),
]

for filename, project, pages in jobs:
    pdf_path = PDF_DIR / filename
    output_path = OUT_DIR / project / "pages"
    output_path.mkdir(parents=True, exist_ok=True)

    with pymupdf.open(pdf_path) as pdf:
        for page_number, image_name in pages:
            if page_number > len(pdf):
                raise ValueError(
                    f"{filename} has only {len(pdf)} pages; "
                    f"requested page {page_number}"
                )

            page = pdf[page_number - 1]  # PDF page numbers start at 1
            image = page.get_pixmap(dpi=DPI, alpha=False)
            destination = output_path / image_name
            image.save(destination)

            print(f"Saved {destination}: {image.width} × {image.height}")

print("Done: 5 clean images ready to import into Label Studio.")