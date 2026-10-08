"""Rebuild from the five original Label Studio ZIPs. Requires Pillow.
Usage: python prepare_dataset.py --exports data/exports --output data/doors_commercial_v1
"""
import argparse
from collections import defaultdict
import hashlib
import io
import json
import math
from pathlib import Path
import random
import zipfile
from PIL import Image

PROJECTS = {1: ('asc', 'train'), 2: ('gvhc_stockton', 'train'),
            3: ('greenville', 'train'), 4: ('norco', 'valid'),
            5: ('uc_davis_aic', 'test')}
TILE = 768
STRIDE = 384

def positions(length):
    return sorted(set(list(range(0, max(1, length - TILE + 1), STRIDE)) + [max(0, length - TILE)]))

def coco():
    return {'info': {'description': 'Commercial doors v1'}, 'licenses': [],
            'categories': [{'id': 0, 'name': 'door', 'supercategory': 'opening'}],
            'images': [], 'annotations': []}

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--exports', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    if args.output.exists():
        raise SystemExit('Output exists. Choose a new directory to preserve earlier work.')
    args.output.mkdir(parents=True)
    tiled = {s: coco() for s in ('train', 'valid', 'test')}
    full = {s: coco() for s in tiled}
    for s in tiled:
        (args.output / s).mkdir()
        (args.output / 'full_pages' / s).mkdir(parents=True)
    rng = random.Random(42)
    hashes = {}
    report = {'tile_size': TILE, 'stride': STRIDE, 'seed': 42, 'pages': [], 'duplicates': [], 'splits': {}}
    for project_id, (project, split) in PROJECTS.items():
        matches = sorted(args.exports.glob(f'project-{project_id}-at-*.zip'))
        if len(matches) != 1:
            raise ValueError(f'Expected one ZIP for project {project_id}; got {matches}')
        with zipfile.ZipFile(matches[0]) as z:
            data = json.loads(z.read('result.json'))
            assert data['categories'] == [{'id': 0, 'name': 'door'}], data['categories']
            grouped = defaultdict(list)
            for a in data['annotations']:
                grouped[a['image_id']].append(a)
            for source in sorted(data['images'], key=lambda i: i['id']):
                basename = Path(source['file_name']).name
                raw = z.read('images/' + basename)
                digest = hashlib.sha256(raw).hexdigest()
                if digest in hashes:
                    if hashes[digest]['split'] != split:
                        raise ValueError('Duplicate image across project splits')
                    report['duplicates'].append({'removed': basename, 'kept': hashes[digest]['file'],
                                                  'removed_annotation_ids': [a['id'] for a in grouped[source['id']]]})
                    continue
                hashes[digest] = {'file': basename, 'split': split}
                image = Image.open(io.BytesIO(raw)).convert('RGB')
                w, h = image.size
                assert (w, h) == (source['width'], source['height'])
                annotations = grouped[source['id']]
                for a in annotations:
                    x, y, bw, bh = a['bbox']
                    assert all(math.isfinite(v) for v in (x, y, bw, bh))
                    assert bw > 0 and bh > 0 and x >= 0 and y >= 0 and x+bw <= w+.001 and y+bh <= h+.001
                stem = f'{project}_image_{source["id"]:03d}'
                full_name = stem + '.png'
                image.save(args.output / 'full_pages' / split / full_name)
                fd = full[split]; fid = len(fd['images']) + 1
                fd['images'].append({'id': fid, 'file_name': full_name, 'width': w, 'height': h,
                                     'project': project, 'source_file': basename})
                for a in annotations:
                    fd['annotations'].append({'id': len(fd['annotations'])+1, 'image_id': fid,
                        'category_id': 0, 'bbox': a['bbox'], 'area': a['bbox'][2]*a['bbox'][3],
                        'iscrowd': 0, 'source_annotation_id': a['id']})
                positive, negative = [], []
                coverage = set()
                for top in positions(h):
                    for left in positions(w):
                        clipped = []
                        for a in annotations:
                            x,y,bw,bh = a['bbox']
                            x1,y1 = max(x,left),max(y,top)
                            x2,y2 = min(x+bw,left+TILE,w),min(y+bh,top+TILE,h)
                            if x2>x1 and y2>y1:
                                box = [x1-left,y1-top,x2-x1,y2-y1]
                                clipped.append((a['id'],box))
                                if abs((x2-x1)* (y2-y1)-bw*bh) < .01:
                                    coverage.add(a['id'])
                        item = (left,top,clipped)
                        if clipped:
                            positive.append(item)
                        else:
                            negative.append(item)
                assert coverage == {a['id'] for a in annotations}, 'A door never appears complete in a tile'
                # Train: 1 negative per 3 positive tiles, from tiles containing drawn content.
                # Validation/test retain the complete page grid, including all background.
                if split == 'train':
                    useful = []
                    for left,top,boxes in negative:
                        gray = image.crop((left,top,left+TILE,top+TILE)).convert('L').resize((192,192))
                        hist = gray.histogram()
                        if sum(hist[:220]) / (192*192) >= .005:
                            useful.append((left,top,boxes))
                    negative = rng.sample(useful, min(len(useful), math.ceil(len(positive)/3)))
                selected = sorted(positive+negative, key=lambda v:(v[1],v[0]))
                td = tiled[split]
                for left,top,boxes in selected:
                    name = f'{stem}_x{left:05d}_y{top:05d}.png'
                    tile = image.crop((left,top,left+TILE,top+TILE))
                    tile.save(args.output / split / name)
                    iid = len(td['images'])+1
                    td['images'].append({'id':iid,'file_name':name,'width':TILE,'height':TILE,
                        'project':project,'source_file':full_name,'tile_origin':[left,top]})
                    for source_aid,box in boxes:
                        td['annotations'].append({'id':len(td['annotations'])+1,'image_id':iid,
                            'category_id':0,'bbox':box,'area':box[2]*box[3],'iscrowd':0,
                            'source_annotation_id':source_aid})
                entry = {'project':project,'split':split,'source':basename,'sha256':digest,
                         'doors':len(annotations),'positive_tiles':len(positive),'negative_tiles':len(negative)}
                report['pages'].append(entry)
                print(entry, flush=True)
    for split in tiled:
        for root, data in [(args.output,tiled[split]),(args.output/'full_pages',full[split])]:
            (root/split/'_annotations.coco.json').write_text(json.dumps(data,indent=2))
        report['splits'][split] = {'pages':len(full[split]['images']),
            'source_annotations':len(full[split]['annotations']), 'tiles':len(tiled[split]['images']),
            'tile_annotations':len(tiled[split]['annotations'])}
    (args.output/'preparation_report.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report['splits'],indent=2))

if __name__ == '__main__':
    main()
