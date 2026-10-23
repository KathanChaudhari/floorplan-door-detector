"""Extract seven selected floor-plan pages and render PNGs for Label Studio.

Install: python -m pip install pymupdf
Place uccs.pdf, towneplace.pdf and wieden.pdf in pdfs/, then run:
    python extract_selected_plans.py

Page numbers below are PDF viewer page numbers, starting at 1.
"""
import argparse
from contextlib import ExitStack
import json
from pathlib import Path

try:
    import pymupdf
except ImportError:
    raise SystemExit('Install the dependency first: python -m pip install pymupdf')


PROJECTS = {
    'uccs': ('uccs.pdf', [15, 16, 17]),
    'towneplace': ('towneplace.pdf', [9, 10]),
    'wieden': ('wieden.pdf', [14, 15]),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir', type=Path, default=Path('pdfs'))
    parser.add_argument('--output', type=Path, default=Path('selected_plans'))
    parser.add_argument('--dpi', type=int, default=150)
    args = parser.parse_args()
    if args.dpi < 1:
        parser.error('--dpi must be positive')
    if args.output.exists():
        parser.error('Output already exists. Choose a new folder using --output selected_plans_2')

    with ExitStack() as stack:
        documents = {}
        # Check every input before writing any output.
        for project, (filename, pages) in PROJECTS.items():
            path = args.input_dir / filename
            if not path.is_file():
                parser.error(f'Missing PDF: {path.resolve()}')
            try:
                doc = stack.enter_context(pymupdf.open(path))
            except Exception as exc:
                parser.error(f'Cannot open {path}: {exc}')
            if not doc.is_pdf or doc.needs_pass:
                parser.error(f'Expected an accessible, unencrypted PDF: {path}')
            if max(pages) > len(doc):
                parser.error(f'{filename} has {len(doc)} pages; requested {pages}. Check the source file.')
            documents[project] = doc

        image_dir = args.output / 'images'
        pdf_dir = args.output / 'pdfs'
        image_dir.mkdir(parents=True)
        pdf_dir.mkdir()
        manifest = []
        for project, (filename, pages) in PROJECTS.items():
            source = documents[project]
            with pymupdf.open() as selected:
                for page_number in pages:
                    index = page_number - 1  # PyMuPDF uses zero-based indices.
                    selected.insert_pdf(source, from_page=index, to_page=index)
                    png_name = f'{project}_pdfpage_{page_number:03d}.png'
                    pix = source[index].get_pixmap(dpi=args.dpi, alpha=False)
                    pix.save(image_dir / png_name)
                    manifest.append({
                        'project': project, 'source_pdf': filename,
                        'source_pdf_page': page_number,
                        'image': f'images/{png_name}',
                        'width': pix.width, 'height': pix.height, 'dpi': args.dpi,
                    })
                    print(f'{filename}: page {page_number} -> {png_name} ({pix.width} x {pix.height})', flush=True)
                    del pix
                selected.save(pdf_dir / f'{project}_selected.pdf', garbage=4, deflate=True)

        (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
        print(f'\nDone: {len(manifest)} PNGs and {len(PROJECTS)} selected-page PDFs.')
        print(f'Import PNGs from: {image_dir.resolve()}')


if __name__ == '__main__':
    main()
