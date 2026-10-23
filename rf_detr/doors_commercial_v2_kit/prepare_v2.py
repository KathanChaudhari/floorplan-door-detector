"""Build v2 from your existing v1 full-page PNGs. Requires Pillow; no model needed."""
import argparse
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import random
import shutil

from PIL import Image

HERE = Path(__file__).resolve().parent
TILE, STRIDE, MARGIN = 768, 384, 4


def positions(length):
    return sorted(set(range(0, max(1, length - TILE + 1), STRIDE)) | {max(0, length - TILE)})


def intersects(a, b):
    return min(a[2], b[2]) > max(a[0], b[0]) and min(a[3], b[3]) > max(a[1], b[1])


def xyxy(a):
    x, y, w, h = a['bbox']
    return x, y, x + w, y + h


def complete_crop(rect, annotations, width, height):
    """Expand a crop until every intersecting labelled door fits completely."""
    rect = tuple(rect)
    while True:
        expanded = list(rect)
        for a in annotations:
            box = xyxy(a)
            if intersects(rect, box):
                expanded[0] = min(expanded[0], max(0, math.floor(box[0]) - MARGIN))
                expanded[1] = min(expanded[1], max(0, math.floor(box[1]) - MARGIN))
                expanded[2] = max(expanded[2], min(width, math.ceil(box[2]) + MARGIN))
                expanded[3] = max(expanded[3], min(height, math.ceil(box[3]) + MARGIN))
        expanded = tuple(expanded)
        if expanded == rect:
            return rect
        rect = expanded


def coco():
    return {'info': {'description': 'Commercial doors v2'}, 'licenses': [],
            'categories': [{'id': 0, 'name': 'door', 'supercategory': 'opening'}],
            'images': [], 'annotations': []}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('doors_commercial_v1/data/full_pages'))
    parser.add_argument('--output', type=Path, default=HERE / 'data')
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Output exists. Choose a new --output folder; earlier work is preserved.')
    expected = json.loads((HERE / 'source_hashes.json').read_text())
    # Verify all inputs before creating the dataset. No placeholder images are generated.
    for relative, digest in expected.items():
        path = args.source / relative
        if not path.is_file():
            parser.error(f'Missing original image: {path}')
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            parser.error(f'Original image differs from the audited source: {path}')
    region_data = json.loads((HERE / 'review_regions.json').read_text())
    rng = random.Random(42)
    report = {'tile_size': TILE, 'stride': STRIDE, 'seed': 42, 'pages': [], 'splits': {}}
    for split in ('train', 'valid', 'test'):
        data = json.loads((HERE / 'annotations' / f'{split}.coco.json').read_text())
        by_image = defaultdict(list)
        for a in data['annotations']:
            by_image[a['image_id']].append(a)
        dest = args.output / split
        full_dest = args.output / 'full_pages' / split
        dest.mkdir(parents=True)
        full_dest.mkdir(parents=True)
        shutil.copy2(HERE / 'annotations' / f'{split}.coco.json', full_dest / '_annotations.coco.json')
        tiled = coco()
        for source in data['images']:
            name = source['file_name']
            path = args.source / split / name
            shutil.copy2(path, full_dest / name)
            image = Image.open(path).convert('RGB')
            width, height = image.size
            annotations = by_image[source['id']]
            assert image.size == (source['width'], source['height'])
            for a in annotations:
                x, y, w, h = a['bbox']
                assert all(math.isfinite(v) for v in (x, y, w, h))
                assert min(w, h) > 0 and min(x, y) >= 0
                assert x + w <= width + .001 and y + h <= height + .001
            excluded = [r['xyxy'] for r in region_data['excluded'] if r['source'] == name]
            anchors = [(x, y, x + TILE, y + TILE) for y in positions(height) for x in positions(width)]
            if split == 'train':
                anchors += [tuple(r['xyxy']) for r in region_data['regions'] if r['source'] == name]
                # Guarantee a candidate centred on each label, including doors far from grid centres.
                for a in annotations:
                    x, y, w, h = a['bbox']
                    left = min(max(0, int(x + w / 2 - TILE / 2)), max(0, width - TILE))
                    top = min(max(0, int(y + h / 2 - TILE / 2)), max(0, height - TILE))
                    anchors.append((left, top, left + TILE, top + TILE))
            forced_empty = {tuple(r['xyxy']) for r in region_data['regions']
                            if r['source'] == name and r.get('reviewed_empty')}
            selected, negatives, seen = [], [], set()
            forced_negative_count = 0
            skipped = 0
            for rect in anchors:
                if split == 'train':
                    rect = complete_crop(rect, annotations, width, height)
                    if any(intersects(rect, r) for r in excluded):
                        skipped += 1
                        continue
                if rect in seen:
                    continue
                seen.add(rect)
                boxes = [a for a in annotations if intersects(rect, xyxy(a))]
                if split == 'train' and not boxes and rect in forced_empty:
                    selected.append((rect, boxes))
                    forced_negative_count += 1
                elif split == 'train' and not boxes:
                    gray = image.crop(rect).convert('L').resize((192, 192))
                    if sum(gray.histogram()[:220]) / (192 * 192) >= .005:
                        negatives.append((rect, boxes))
                else:
                    selected.append((rect, boxes))
            if split == 'train':
                positive_count = sum(bool(boxes) for _, boxes in selected)
                budget = max(0, math.ceil(positive_count / 3) - forced_negative_count)
                selected += rng.sample(negatives, min(len(negatives), budget))
            covered = set()
            for rect, boxes in sorted(selected, key=lambda item: item[0]):
                left, top, right, bottom = rect
                crop_name = f'{Path(name).stem}_x{left:05d}_y{top:05d}_w{right-left:04d}_h{bottom-top:04d}.png'
                image.crop(rect).save(dest / crop_name, compress_level=1)
                iid = len(tiled['images']) + 1
                tiled['images'].append({'id': iid, 'file_name': crop_name,
                    'width': right-left, 'height': bottom-top, 'source_file': name,
                    'tile_origin': [left, top], 'project': source.get('project', '')})
                for a in boxes:
                    x1, y1, x2, y2 = xyxy(a)
                    if split == 'train':
                        assert x1 >= left and y1 >= top and x2 <= right and y2 <= bottom
                    box = [max(x1, left)-left, max(y1, top)-top,
                           min(x2, right)-max(x1, left), min(y2, bottom)-max(y1, top)]
                    tiled['annotations'].append({'id': len(tiled['annotations']) + 1,
                        'image_id': iid, 'category_id': 0, 'bbox': box, 'area': box[2]*box[3],
                        'iscrowd': 0, 'source_annotation_id': a['id']})
                    covered.add(a['id'])
            eligible = {a['id'] for a in annotations if not any(intersects(xyxy(a), r) for r in excluded)}
            missing = eligible - covered if split == 'train' else set()
            if missing:
                raise RuntimeError(f'{name}: labels lack a safe training crop: {sorted(missing)}')
            entry = {'source': name, 'split': split, 'source_labels': len(annotations),
                     'crops': len(selected), 'excluded_candidates': skipped,
                     'reviewed_empty_crops_included': forced_negative_count,
                     'covered_source_labels': len(covered),
                     'excluded_source_label_ids': sorted({a['id'] for a in annotations} - eligible) if split == 'train' else []}
            report['pages'].append(entry)
            print(json.dumps(entry), flush=True)
        (dest / '_annotations.coco.json').write_text(json.dumps(tiled, indent=2))
        report['splits'][split] = {'pages': len(data['images']), 'source_labels': len(data['annotations']),
                                  'crops': len(tiled['images']), 'crop_annotations': len(tiled['annotations'])}
    (args.output / 'preparation_report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report['splits'], indent=2))


if __name__ == '__main__':
    main()
