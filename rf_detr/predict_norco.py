"""Inspect RF-DETR Small on prepared Norco full pages, using overlapping tiles.
Run from rf_detr: python predict_norco.py
Requires the existing rfdetr environment (numpy, Pillow, torch).
Outputs are a diagnostic at one confidence/IoU threshold, NOT COCO mAP.
NMS suppresses overlapping duplicates; it may retain clipped duplicates or merge
nearby doors. Inspect the review PNGs before trusting counts.
"""
import argparse
from collections import defaultdict
from datetime import datetime
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

TILE = 768
STRIDE = 384


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


def match_boxes(boxes, scores, truth, threshold):
    """Score-ordered, one-to-one diagnostic matching at one IoU threshold."""
    matched_predictions = set()
    matched_truth = set()
    for idx in np.argsort(-scores, kind='stable'):
        available = [j for j in range(len(truth)) if j not in matched_truth]
        if not available:
            break
        overlaps = ious(boxes[idx], truth[available])
        best = int(np.argmax(overlaps))
        if overlaps[best] >= threshold:
            matched_predictions.add(int(idx))
            matched_truth.add(available[best])
    return matched_predictions, matched_truth


def font(size):
    for name in ('/System/Library/Fonts/Supplemental/Arial.ttf', 'DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def draw_box(draw, box, color, label, label_font):
    x1, y1, x2, y2 = [int(round(v)) for v in box]
    draw.rectangle((x1, y1, x2, y2), outline=color, width=4)
    y = max(0, y1 - 27)
    text_box = draw.textbbox((x1, y), label, font=label_font)
    draw.rectangle(text_box, fill='white')
    draw.text((x1, y), label, font=label_font, fill=color)


def render(page, boxes, scores, truth, mp, mt, destination, stem):
    label_font = font(23)
    pred = page.copy()
    d = ImageDraw.Draw(pred)
    for idx, (box, score) in enumerate(zip(boxes, scores)):
        draw_box(d, box, '#008040', f'P{idx+1} {score:.2f}', label_font)
    pred.save(destination / f'{stem}_predictions.png')
    review = page.copy()
    d = ImageDraw.Draw(review)
    for idx, box in enumerate(truth):
        color = '#2060d0' if idx in mt else '#d000c0'
        draw_box(d, box, color, f'GT{idx+1}', label_font)
    for idx, (box, score) in enumerate(zip(boxes, scores)):
        color = '#008040' if idx in mp else '#e04000'
        draw_box(d, box, color, f'P{idx+1} {score:.2f}', label_font)
    review.save(destination / f'{stem}_review.png')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkpoint', type=Path, default=Path('outputs/doors_commercial_v1/checkpoint_best_ema.pth'))
    p.add_argument('--pages', type=Path, default=Path('doors_commercial_v1/data/full_pages/valid'))
    p.add_argument('--output', type=Path, default=None)
    p.add_argument('--threshold', type=float, default=0.30)
    p.add_argument('--nms-iou', type=float, default=0.50)
    p.add_argument('--match-iou', type=float, default=0.50)
    p.add_argument('--device', choices=['mps', 'cuda', 'cpu'], default='mps')
    args = p.parse_args()
    for key in ('threshold', 'nms_iou', 'match_iou'):
        if not 0 < getattr(args, key) <= 1:
            p.error(f'{key} must be greater than 0 and at most 1')
    if not args.checkpoint.is_file():
        p.error(f'Checkpoint not found: {args.checkpoint}. Run from the rf_detr folder.')
    annotation_path = args.pages / '_annotations.coco.json'
    if not annotation_path.is_file():
        p.error(f'Annotations not found: {annotation_path}')
    data = json.loads(annotation_path.read_text())
    if {c['name'] for c in data['categories']} != {'door'}:
        p.error('This script expects a single door class.')
    grouped = defaultdict(list)
    for a in data['annotations']:
        x, y, w, h = a['bbox']
        grouped[a['image_id']].append([x, y, x+w, y+h])
    for item in data['images']:
        if not (args.pages / item['file_name']).is_file():
            p.error(f'Missing image: {item["file_name"]}')
    destination = args.output or Path('outputs') / ('norco_review_' + datetime.now().strftime('%Y%m%d_%H%M%S'))
    if destination.exists() and any(destination.iterdir()):
        p.error('Output folder is nonempty; use a new --output folder.')
    import torch
    from rfdetr import RFDETRSmall
    if args.device == 'mps' and not torch.backends.mps.is_available():
        p.error('MPS unavailable. Use --device cpu if needed.')
    if args.device == 'cuda' and not torch.cuda.is_available():
        p.error('CUDA unavailable.')
    print(f'Loading checkpoint on {args.device}...', flush=True)
    model = RFDETRSmall(pretrain_weights=str(args.checkpoint.resolve()),
                       num_classes=1, resolution=512, device=args.device)
    destination.mkdir(parents=True, exist_ok=True)
    report = {'checkpoint': str(args.checkpoint.resolve()), 'threshold': args.threshold,
              'nms_iou': args.nms_iou, 'match_iou': args.match_iou,
              'tile_size': TILE, 'stride': STRIDE, 'pages': [],
              'note': 'Full-page diagnostic at fixed thresholds; not COCO mAP. NMS may leave or remove real objects; inspect overlays.'}
    for item in data['images']:
        with Image.open(args.pages / item['file_name']) as source:
            page = source.convert('RGB')
        width, height = page.size
        if (width, height) != (item['width'], item['height']):
            raise ValueError(f'Image/annotation dimensions differ: {item["file_name"]}')
        grid = [(x, y) for y in positions(height) for x in positions(width)]
        boxes, scores = [], []
        print(f'\n{item["file_name"]}: {len(grid)} tiles', flush=True)
        with torch.inference_mode():
            for count, (left, top) in enumerate(grid, 1):
                crop = page.crop((left, top, min(left+TILE, width), min(top+TILE, height)))
                tile = Image.new('RGB', (TILE, TILE), 'white')
                tile.paste(crop, (0, 0))
                detections = model.predict(tile, threshold=args.threshold)
                for box, score in zip(detections.xyxy, detections.confidence):
                    box = np.asarray(box, dtype=float) + np.array([left, top, left, top])
                    box[[0, 2]] = np.clip(box[[0, 2]], 0, width)
                    box[[1, 3]] = np.clip(box[[1, 3]], 0, height)
                    if np.isfinite(box).all() and np.isfinite(score) and box[2]>box[0] and box[3]>box[1]:
                        boxes.append(box); scores.append(float(score))
                if count == 1 or count % 20 == 0 or count == len(grid):
                    print(f'  tile {count}/{len(grid)}', flush=True)
        boxes = np.asarray(boxes, dtype=float).reshape(-1, 4)
        scores = np.asarray(scores, dtype=float)
        raw_count = len(boxes)
        keep = nms(boxes, scores, args.nms_iou)
        boxes, scores = boxes[keep], scores[keep]
        truth = np.asarray(grouped[item['id']], dtype=float).reshape(-1, 4)
        mp, mt = match_boxes(boxes, scores, truth, args.match_iou)
        tp, fp, fn = len(mp), len(boxes)-len(mp), len(truth)-len(mt)
        entry = {'file': item['file_name'], 'labeled_doors': len(truth),
                 'raw_tile_predictions': raw_count, 'predicted_doors_after_nms': len(boxes),
                 'matched_predictions': tp, 'unmatched_predictions': fp, 'missed_labels': fn,
                 'precision': tp/len(boxes) if len(boxes) else None,
                 'recall': tp/len(truth) if len(truth) else None,
                 'predictions': [{'id': i+1, 'xyxy': b.tolist(), 'confidence': float(s),
                                  'matched': i in mp} for i, (b,s) in enumerate(zip(boxes,scores))]}
        stem = Path(item['file_name']).stem
        render(page, boxes, scores, truth, mp, mt, destination, stem)
        report['pages'].append(entry)
        (destination / 'summary.json').write_text(json.dumps(report, indent=2))
        print(f'  Labels: {len(truth)} | Predictions: {len(boxes)} | Matches: {tp} | Unmatched: {fp} | Missed labels: {fn}', flush=True)
    (destination / 'README.txt').write_text(
        'predictions.png: all predicted boxes with confidence.\n'
        'review.png: GREEN matched prediction; ORANGE unmatched prediction; '
        'BLUE matched annotation; MAGENTA missed annotation.\n'
        'Matching uses one-to-one, score-ordered IoU at the threshold in summary.json.\n'
        'An unmatched box may still show a real door with inaccurate boundaries. '
        'A matching pair can be hard to see because the outlines overlap.\n'
        'Numbers refer to full pages after NMS, not overlapping tile instances. '
        'This is not the training mAP score. Inspect retained duplicates and nearby doors.\n')
    print(f'\nSaved results to: {destination.resolve()}\nSend summary.json and the review PNGs for inspection.', flush=True)


if __name__ == '__main__':
    main()
