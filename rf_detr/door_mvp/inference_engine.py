"""Run the v3 door model on a new PDF or image; no annotations required.

From your rf_detr folder:
  .venv/bin/python predict_doors.py --input pdfs/new_project.pdf --pages 5
  .venv/bin/python predict_doors.py --input new_plan.png

Optional: --roi 5 10 82 90 (left/top/right/bottom percentages of the page).
Select actual floor-plan pages, not schedules or repeated overall plans.
Counts are unreviewed detections, not verified physical-door quantities.

Uses the same 768/384 tiling, boundary recheck, and NMS as predict_norco_v2.py.
The --roi option deliberately restricts the input area; without it, the full
page is processed. No rules automatically remove plants, stairs, or legends.
Requires the working RF-DETR 1.11.2 environment; PDFs also require PyMuPDF.
"""
import argparse
import csv
from datetime import datetime
from importlib.metadata import PackageNotFoundError, version
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

TILE, STRIDE = 768, 384


def positions(length):
    return sorted(set(range(0, max(1, length - TILE + 1), STRIDE)) | {max(0, length - TILE)})


def ious(box, boxes):
    if not len(boxes):
        return np.empty(0)
    lo = np.maximum(box[:2], boxes[:, :2])
    hi = np.minimum(box[2:], boxes[:, 2:])
    inter = np.maximum(hi - lo, 0).prod(axis=1)
    area = np.maximum(box[2:] - box[:2], 0).prod()
    areas = np.maximum(boxes[:, 2:] - boxes[:, :2], 0).prod(axis=1)
    return inter / np.maximum(area + areas - inter, 1e-9)


def nms(boxes, scores, threshold):
    order = np.argsort(-scores, kind='stable')
    keep = []
    while len(order):
        idx = int(order[0])
        keep.append(idx)
        rest = order[1:]
        order = rest[ious(boxes[idx], boxes[rest]) <= threshold]
    return np.asarray(keep, dtype=int)


def edge_sides(box, origin, size, margin=4):
    x, y = origin
    w, h = size
    return [side for side, flag in enumerate((
        x > 0 and box[0] - x <= margin,
        y > 0 and box[1] - y <= margin,
        x + TILE < w and x + TILE - box[2] <= margin,
        y + TILE < h and y + TILE - box[3] <= margin)) if flag]


def confirms(fragment, complete):
    if not fragment['edges'] or complete['edges']:
        return False
    a = np.array(fragment['box'])
    b = np.array(complete['box'])
    area = np.prod(a[2:] - a[:2])
    inter = np.maximum(np.minimum(a[2:], b[2:]) - np.maximum(a[:2], b[:2]), 0).prod()
    if area <= 0 or inter / area < .85:
        return False
    x, y = fragment['origin']
    bounds = np.array([x, y, x + TILE, y + TILE])
    if not all((b[k] < bounds[k] - 4 if k < 2 else b[k] > bounds[k] + 4) for k in fragment['edges']):
        return False
    clipped = np.r_[np.maximum(b[:2], bounds[:2]), np.minimum(b[2:], bounds[2:])]
    return bool(ious(a, clipped.reshape(1, 4))[0] >= .5)


def detect_tile(model, page, origin, threshold):
    x, y = origin
    w, h = page.size
    tile = Image.new('RGB', (TILE, TILE), 'white')
    tile.paste(page.crop((x, y, min(x + TILE, w), min(y + TILE, h))), (0, 0))
    detections = model.predict(tile, threshold=threshold)
    result = []
    for box, score in zip(detections.xyxy, detections.confidence):
        box = np.array(box, dtype=float) + np.array([x, y, x, y])
        box[[0, 2]] = np.clip(box[[0, 2]], 0, w)
        box[[1, 3]] = np.clip(box[[1, 3]], 0, h)
        if np.isfinite(box).all() and np.isfinite(score) and np.all(box[2:] > box[:2]):
            result.append(dict(box=box.tolist(), score=float(score), origin=list(origin),
                               edges=edge_sides(box, origin, page.size)))
    return result


def detect_page(model, page, threshold, nms_iou):
    w, h = page.size
    grid = [(x, y) for y in positions(h) for x in positions(w)]
    cache, raw = {}, []
    print(f'  {len(grid)} initial tiles', flush=True)
    for number, origin in enumerate(grid, 1):
        cache[origin] = detect_tile(model, page, origin, threshold)
        raw.extend(cache[origin])
        if number % 20 == 0 or number == len(grid):
            print(f'  Tile {number}/{len(grid)}', flush=True)
    fragments = [r for r in raw if r['edges']]
    complete = [r for r in raw if not r['edges']]
    pending = [r for r in fragments if not any(confirms(r, c) for c in complete)]
    origins = set()
    for r in pending:
        b = r['box']
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        origins.add((int(np.clip(round((cx - TILE / 2) / 32) * 32, 0, max(0, w - TILE))),
                     int(np.clip(round((cy - TILE / 2) / 32) * 32, 0, max(0, h - TILE)))))
    origins = sorted(origins - set(cache))
    print(f'  Rechecking {len(origins)} shifted crops', flush=True)
    added = []
    for number, origin in enumerate(origins, 1):
        ds = detect_tile(model, page, origin, threshold)
        added.extend(c for c in ds if not c['edges'] and any(confirms(r, c) for r in pending))
        if number % 20 == 0 or number == len(origins):
            print(f'  Recheck {number}/{len(origins)}', flush=True)
    candidates = complete + added
    removed = {i for i, r in enumerate(raw) if r['edges'] and any(confirms(r, c) for c in candidates)}
    revised = [r for i, r in enumerate(raw) if i not in removed] + added
    boxes = np.array([r['box'] for r in revised], float).reshape(-1, 4)
    scores = np.array([r['score'] for r in revised], float)
    keep = nms(boxes, scores, nms_iou)
    return [revised[i] for i in keep], dict(initial_tiles=len(grid), shifted_crops=len(origins),
                                           suppressed_fragments=len(removed))


def page_numbers(text, count):
    selected = set()
    for group in text.split(','):
        bounds = [int(v) for v in group.strip().split('-')]
        if len(bounds) == 1:
            selected.add(bounds[0])
        elif len(bounds) == 2 and bounds[0] <= bounds[1]:
            selected.update(range(bounds[0], bounds[1] + 1))
        else:
            raise ValueError('Use PDF page numbers such as 5 or 5,7-9.')
    if not selected or min(selected) < 1 or max(selected) > count:
        raise ValueError(f'PDF page numbers must be between 1 and {count}.')
    return sorted(selected)


def roi_pixels(size, roi):
    w, h = size
    if roi is None:
        return (0, 0, w, h)
    left, top, right, bottom = roi
    return (math.floor(left * w / 100), math.floor(top * h / 100),
            math.ceil(right * w / 100), math.ceil(bottom * h / 100))


def label_font(size):
    for name in ('/System/Library/Fonts/Supplemental/Arial.ttf', 'DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def annotated_image(page, detections, roi, preview=False):
    image = page.copy()
    draw = ImageDraw.Draw(image)
    scale = max(.5, min(2, page.width / 6300))
    width = max(2, round(4 * scale))
    font = label_font(max(14, round(23 * scale)))
    if roi != (0, 0, page.width, page.height):
        draw.rectangle((roi[0], roi[1], roi[2] - 1, roi[3] - 1), outline='#dd8700', width=width)
    for d in detections:
        box = [round(v) for v in d['box']]
        draw.rectangle(box, outline='#0066ff', width=width)
        position = (max(0, box[0]), max(0, box[1] - round(28 * scale)))
        label = f'{d["id"]} {d["score"]:.2f}'
        draw.rectangle(draw.textbbox(position, label, font=font), fill='white')
        draw.text(position, label, fill='#0066ff', font=font)
    title = 'PREVIEW ONLY - no model run' if preview else f'Detections: {len(detections)} - unreviewed'
    draw.rectangle(draw.textbbox((10, 10), title, font=font), fill='white')
    draw.text((10, 10), title, font=font, fill='#0066ff')
    return image


def save_report(output, report):
    path = output / 'predictions.json'
    temporary = output / 'predictions.json.tmp'
    temporary.write_text(json.dumps(report, indent=2) + '\n')
    temporary.replace(path)
    with (output / 'detections.csv').open('w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['input', 'pdf_page', 'detection_id', 'confidence', 'x1', 'y1', 'x2', 'y2'])
        for p in report['pages']:
            for d in p['detections']:
                writer.writerow([report['input'], p['pdf_page'], d['id'], d['score'], *d['box']])


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--input', required=True, type=Path, help='PDF or one PNG/JPEG image.')
    parser.add_argument('--pages', help='Required for PDFs: 1-based page numbers, e.g. 5 or 5,7-9.')
    parser.add_argument('--checkpoint', type=Path, default=Path('outputs/doors_commercial_v3_run2/checkpoint_best_ema.pth'))
    parser.add_argument('--output', type=Path, help='New output folder; defaults to a timestamped outputs/ folder.')
    parser.add_argument('--dpi', type=int, default=150, help='PDF rendering DPI. Default: 150, matching training preparation.')
    parser.add_argument('--threshold', type=float, default=.3)
    parser.add_argument('--nms-iou', type=float, default=.5)
    parser.add_argument('--device', choices=['mps', 'cuda', 'cpu'], default='mps')
    parser.add_argument('--roi', nargs=4, type=float, metavar=('LEFT', 'TOP', 'RIGHT', 'BOTTOM'),
                        help='Drawing-area bounds as percentages, each 0..100. Same bounds apply to every selected page.')
    parser.add_argument('--preview-only', action='store_true', help='Render selected pages and ROI without loading the model.')
    args = parser.parse_args()
    if not args.input.is_file():
        parser.error(f'Input missing: {args.input}')
    for key in ('threshold', 'nms_iou'):
        if not 0 < getattr(args, key) <= 1:
            parser.error(f'{key} must be in (0, 1].')
    if not 36 <= args.dpi <= 600:
        parser.error('--dpi must be between 36 and 600.')
    if args.roi and not (all(math.isfinite(v) for v in args.roi) and
                         0 <= args.roi[0] < args.roi[2] <= 100 and 0 <= args.roi[1] < args.roi[3] <= 100):
        parser.error('--roi needs LEFT < RIGHT and TOP < BOTTOM, within 0..100.')
    output = args.output or Path('outputs') / ('door_predictions_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
    if output.exists():
        parser.error('Output already exists. Use a new --output folder.')
    document, source_image = None, None
    try:
        if args.input.suffix.lower() == '.pdf':
            if not args.pages:
                parser.error('Choose PDF pages with --pages, using 1-based PDF page numbers.')
            try:
                import pymupdf
            except ImportError:
                parser.error('Install PDF support: .venv/bin/python -m pip install pymupdf')
            document = pymupdf.open(args.input)
            if document.needs_pass:
                parser.error('The PDF is password-protected. Provide an unlocked copy.')
            selected = page_numbers(args.pages, len(document))
        else:
            if args.pages:
                parser.error('--pages applies only to PDFs.')
            with Image.open(args.input) as opened:
                source = ImageOps.exif_transpose(opened).convert('RGBA')
                background = Image.new('RGBA', source.size, 'white')
                source_image = Image.alpha_composite(background, source).convert('RGB')
            selected = [None]
    except (OSError, ValueError) as error:
        if document is not None:
            document.close()
        parser.error(str(error))
    model, torch = None, None
    if not args.preview_only:
        if not args.checkpoint.is_file():
            parser.error(f'Checkpoint missing: {args.checkpoint}')
        try:
            installed = version('rfdetr')
        except PackageNotFoundError:
            parser.error('Use your working environment: .venv/bin/python -m pip install "rfdetr==1.11.2"')
        if installed != '1.11.2':
            parser.error(f'This script targets your RF-DETR 1.11.2 environment; found {installed}.')
        import torch
        from rfdetr import RFDETRSmall
        if args.device == 'mps' and not torch.backends.mps.is_available():
            parser.error('MPS unavailable; use the Mac environment or pass --device cpu.')
        if args.device == 'cuda' and not torch.cuda.is_available():
            parser.error('CUDA unavailable.')
        print('Loading v3 door checkpoint...', flush=True)
        model = RFDETRSmall(pretrain_weights=str(args.checkpoint.resolve()), num_classes=1,
                           resolution=512, device=args.device)
    output.mkdir(parents=True)
    report = dict(input=str(args.input.resolve()), checkpoint=None if args.preview_only else str(args.checkpoint.resolve()),
                  status='running', preview_only=args.preview_only, threshold=args.threshold, nms_iou=args.nms_iou,
                  tile_size=TILE, stride=STRIDE, dpi=args.dpi if document is not None else None,
                  requested_pages=selected, roi_percent=args.roi,
                  coordinate_system='Full rendered-page pixels: x rightward, y downward, origin at top left.',
                  note='Unreviewed model detections. Counts may include false detections, duplicates, and missed doors. '
                       'Sums across pages do not deduplicate repeated floor plans. The ROI is user-selected, not automatic.',
                  total_detections_across_selected_pages=None if args.preview_only else 0, pages=[])
    save_report(output, report)
    try:
        for number in selected:
            stem = args.input.stem if number is None else f'{args.input.stem}_page_{number:03d}'
            print(f'\n{stem}', flush=True)
            if document is not None:
                pix = document[number - 1].get_pixmap(dpi=args.dpi, colorspace=pymupdf.csRGB, alpha=False)
                page = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            else:
                page = source_image
            rect = roi_pixels(page.size, args.roi)
            records, details = [], {}
            if not args.preview_only:
                with torch.inference_mode():
                    records, details = detect_page(model, page.crop(rect), args.threshold, args.nms_iou)
            detections = []
            for index, record in enumerate(records, 1):
                x1, y1, x2, y2 = record['box']
                detections.append(dict(id=index, score=record['score'],
                                       box=[x1 + rect[0], y1 + rect[1], x2 + rect[0], y2 + rect[1]]))
            image_name = stem + ('_preview.png' if args.preview_only else '_doors.png')
            annotated_image(page, detections, rect, args.preview_only).save(output / image_name, compress_level=1)
            entry = dict(pdf_page=number, image_size=list(page.size), roi_pixels=list(rect),
                         count=None if args.preview_only else len(detections), detections=detections,
                         annotated_image=image_name, processing=details)
            report['pages'].append(entry)
            if not args.preview_only:
                report['total_detections_across_selected_pages'] += len(detections)
            save_report(output, report)
            print('  Preview saved.' if args.preview_only else f'  Saved {len(detections)} unreviewed door detections.', flush=True)
        report['status'] = 'completed'
    except KeyboardInterrupt:
        report['status'] = 'interrupted'
        print('\nStopped. Completed pages remain saved; the interrupted page is not complete.', flush=True)
    except Exception as error:
        report['status'] = 'error'
        report['error'] = str(error)
        raise
    finally:
        save_report(output, report)
        if document is not None:
            document.close()
        print(f'\nResults: {output.resolve()}', flush=True)
    if report['status'] == 'interrupted':
        raise SystemExit(130)


if __name__ == '__main__':
    main()
