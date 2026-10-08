from pathlib import Path
import fitz  # PyMuPDF

PDF_DIR = Path("data/pdfs")
OUT_DIR = Path("data/prepared")
DPI = 150

jobs = {
    "Norco FP.pdf": ("norco", [2, 4]),
    "UC Davis AIC FP.PDF": ("uc_davis_aic", [1, 2]),
}

for filename, (project, page_numbers) in jobs.items():
    source = PDF_DIR / filename
    destination = OUT_DIR / project / "pages"
    destination.mkdir(parents=True, exist_ok=True)

    with fitz.open(source) as pdf:
        for page_number in page_numbers:
            page = pdf[page_number - 1]
            pix = page.get_pixmap(dpi=DPI, alpha=False)
            output = destination / f"{project}_page_{page_number:03d}.png"
            pix.save(output)
            print(f"{output}: {pix.width} × {pix.height}")

print("Done. Import these four clean PNGs into Label Studio.")