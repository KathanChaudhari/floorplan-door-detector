"""Combine the verified v2 dataset with the new, project-separated door labels."""
import argparse
from collections import defaultdict
import copy
import hashlib
import json
import math
import os
from pathlib import Path
import random
import shutil

from PIL import Image

HERE = Path(__file__).resolve().parent
TILE, STRIDE, MARGIN = 768, 384, 4


def read(path):
    return json.loads(path.read_text())


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + '\n')


def signature(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def link_or_copy(source, target):
    """Hard links save disk space; changes to linked images affect both datasets."""
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)


def validate(data, folder):
    ids = {im['id'] for im in data['images']}
    if len(ids) != len(data['images']):
        raise ValueError(f'Duplicate image IDs: {folder}')
    names = [im['file_name'] for im in data['images']]
    if len(names) != len(set(names)):
        raise ValueError(f'Duplicate image names: {folder}')
    sizes = {}
    for im in data['images']:
        name = im['file_name']
        if Path(name).name != name or not (folder / name).is_file():
            raise ValueError(f'Missing image or non-local filename: {folder / name}')
        sizes[im['id']] = (im['width'], im['height'])
    annotation_ids = set()
    for a in data['annotations']:
        if a['id'] in annotation_ids or a['image_id'] not in ids or a['category_id'] != 0:
            raise ValueError(f'Invalid annotation identity: {folder}, {a["id"]}')
        annotation_ids.add(a['id'])
        x, y, w, h = a['bbox']
        iw, ih = sizes[a['image_id']]
        if not all(math.isfinite(v) for v in (x, y, w, h)) or min(w, h) <= 0:
            raise ValueError(f'Invalid box: {folder}, {a["id"]}')
        if min(x, y) < 0 or x + w > iw + .001 or y + h > ih + .001:
            raise ValueError(f'Box outside image: {folder}, {a["id"]}')


def xyxy(a):
    x, y, w, h = a['bbox']
    return x, y, x + w, y + h


def intersects(a, b):
    return min(a[2], b[2]) > max(a[0], b[0]) and min(a[3], b[3]) > max(a[1], b[1])


def positions(length):
    return sorted(set(range(0, max(1, length - TILE + 1), STRIDE)) | {max(0, length - TILE)})


def complete_crop(rect, annotations, width, height):
    """Include whole labelled doors rather than teaching clipped-door fragments."""
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


def append_full_pages(destination, addition):
    image_offset = max((im['id'] for im in destination['images']), default=0)
    annotation_offset = max((a['id'] for a in destination['annotations']), default=0)
    image_map, annotation_map = {}, {}
    for index, im in enumerate(addition['images'], image_offset + 1):
        image_map[im['id']] = index
        new = copy.deepcopy(im)
        new['id'] = index
        destination['images'].append(new)
    for index, a in enumerate(addition['annotations'], annotation_offset + 1):
        annotation_map[a['id']] = index
        new = copy.deepcopy(a)
        new.update(id=index, image_id=image_map[a['image_id']])
        destination['annotations'].append(new)
    return annotation_map


def add_training_tiles(data, full, image_folder, output_folder, source_ids):
    by_image = defaultdict(list)
    for a in full['annotations']:
        by_image[a['image_id']].append(a)
    rng = random.Random(42)
    report = []
    for source in full['images']:
        name = source['file_name']
        annotations = by_image[source['id']]
        with Image.open(image_folder / name) as opened:
            image = opened.convert('RGB')
        width, height = image.size
        anchors = [(x, y, min(width, x + TILE), min(height, y + TILE))
                   for y in positions(height) for x in positions(width)]
        for a in annotations:
            x, y, w, h = a['bbox']
            left = min(max(0, int(x + w / 2 - TILE / 2)), max(0, width - TILE))
            top = min(max(0, int(y + h / 2 - TILE / 2)), max(0, height - TILE))
            anchors.append((left, top, min(width, left + TILE), min(height, top + TILE)))
        positives, negatives, seen = [], [], set()
        for anchor in anchors:
            rect = complete_crop(anchor, annotations, width, height)
            if rect in seen:
                continue
            seen.add(rect)
            boxes = [a for a in annotations if intersects(rect, xyxy(a))]
            if boxes:
                positives.append((rect, boxes))
            else:
                gray = image.crop(rect).convert('L').resize((192, 192))
                if sum(gray.histogram()[:220]) / (192 * 192) >= .005:
                    negatives.append((rect, []))
        negatives = rng.sample(negatives, min(len(negatives), math.ceil(len(positives) / 3)))
        selected = sorted(positives + negatives, key=lambda item: item[0])
        covered = set()
        image_id = max((im['id'] for im in data['images']), default=0)
        annotation_id = max((a['id'] for a in data['annotations']), default=0)
        for rect, boxes in selected:
            left, top, right, bottom = rect
            crop_name = f'{Path(name).stem}_x{left:05d}_y{top:05d}_w{right-left:04d}_h{bottom-top:04d}.png'
            target = output_folder / crop_name
            if target.exists():
                raise ValueError(f'Duplicate tile filename: {crop_name}')
            image.crop(rect).save(target, compress_level=1)
            image_id += 1
            data['images'].append(dict(id=image_id, file_name=crop_name,
                width=right-left, height=bottom-top, source_file=name,
                tile_origin=[left, top], project=source['project']))
            for a in boxes:
                x1, y1, x2, y2 = xyxy(a)
                if not (left <= x1 < x2 <= right and top <= y1 < y2 <= bottom):
                    raise ValueError(f'Clipped training box: {name}, {a["id"]}')
                annotation_id += 1
                box = [x1-left, y1-top, x2-x1, y2-y1]
                data['annotations'].append(dict(id=annotation_id, image_id=image_id,
                    category_id=0, bbox=box, area=box[2]*box[3], iscrowd=0,
                    source_annotation_id=source_ids[a['id']]))
                covered.add(a['id'])
        if covered != {a['id'] for a in annotations}:
            raise ValueError(f'Not all labels received training crops: {name}')
        entry = dict(source=name, labels=len(annotations), covered_labels=len(covered),
                     positive_crops=len(positives), negative_crops=len(negatives), crops=len(selected))
        report.append(entry)
        print(json.dumps(entry), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--v2-data', type=Path, default=Path('doors_commercial_v2_kit/data'))
    parser.add_argument('--output', type=Path, default=HERE / 'data')
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Output already exists. Choose another --output folder; previous work is preserved.')
    try:
        expected = read(HERE / 'expected_v2.json')
        # Check every input before creating output.
        for relative, digest in expected.items():
            path = args.v2_data / relative
            if not path.is_file() or signature(read(path)) != digest:
                raise ValueError(f'Missing or different v2 annotations: {path}. Use the prepared v2 dataset.')
            validate(read(path), path.parent)
        for split in ('train', 'holdout'):
            folder = HERE / 'new_pages' / split
            data = read(folder / '_annotations.coco.json')
            validate(data, folder)
            for im in data['images']:
                path = folder / im['file_name']
                with Image.open(path) as image:
                    if image.size != (im['width'], im['height']):
                        raise ValueError(f'Image dimensions do not match annotations: {path}')
                if hashlib.sha256(path.read_bytes()).hexdigest() != im['sha256']:
                    raise ValueError(f'Bundled image changed: {path}')
        if args.output.resolve().is_relative_to(args.v2_data.resolve()):
            raise ValueError('Output must be outside the v2 dataset.')
    except (OSError, ValueError, KeyError) as e:
        parser.error(str(e))
    args.output.mkdir(parents=True)
    # Reuse the unchanged v2 image files. JSON files are independently written.
    for relative in expected:
        original = args.v2_data / relative
        data = read(original)
        destination = args.output / relative
        write(destination, data)
        for im in data['images']:
            link_or_copy(original.parent / im['file_name'], destination.parent / im['file_name'])
    training = read(args.output / 'train/_annotations.coco.json')
    full_training = read(args.output / 'full_pages/train/_annotations.coco.json')
    new_training = read(HERE / 'new_pages/train/_annotations.coco.json')
    source_ids = append_full_pages(full_training, new_training)
    for im in new_training['images']:
        link_or_copy(HERE / 'new_pages/train' / im['file_name'], args.output / 'full_pages/train' / im['file_name'])
    entries = add_training_tiles(training, new_training, HERE / 'new_pages/train', args.output / 'train', source_ids)
    write(args.output / 'train/_annotations.coco.json', training)
    write(args.output / 'full_pages/train/_annotations.coco.json', full_training)
    holdout = read(HERE / 'new_pages/holdout/_annotations.coco.json')
    holdout_folder = args.output / 'full_pages/holdout'
    write(holdout_folder / '_annotations.coco.json', holdout)
    for im in holdout['images']:
        link_or_copy(HERE / 'new_pages/holdout' / im['file_name'], holdout_folder / im['file_name'])
    train_projects = sorted({im['project'] for im in full_training['images']})
    if set(train_projects) & {im['project'] for im in holdout['images']}:
        raise ValueError('Holdout project leaked into training.')
    validate(training, args.output / 'train')
    validate(full_training, args.output / 'full_pages/train')
    eligible_ids = {a['source_annotation_id'] for a in training['annotations']}
    if len(eligible_ids) != 703:
        raise ValueError(f'Expected 703 eligible source doors, found {len(eligible_ids)}.')
    report = dict(version=3, tile_size=TILE, stride=STRIDE, seed=42,
        new_pages=entries, train_projects=train_projects,
        train=dict(pages=len(full_training['images']), source_labels=len(full_training['annotations']),
                   eligible_source_labels=len(eligible_ids), crops=len(training['images']), crop_annotations=len(training['annotations'])),
        valid=dict(project='norco', pages=2, source_labels=100, unchanged_from_v2=True),
        test=dict(project='uc_davis_aic', pages=2, source_labels=92, unchanged_from_v2=True),
        holdout=dict(project='wieden', pages=2, source_labels=94, used_for_training=False),
        note='319 original audit labels include one excluded ambiguous label; 318 old + 385 new = 703 eligible training labels.')
    write(args.output / 'preparation_report.json', report)
    print(json.dumps(report, indent=2), flush=True)
    print(f'Prepared dataset: {args.output.resolve()}', flush=True)


if __name__ == '__main__':
    main()
