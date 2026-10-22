"""Inspect RF-DETR Small on prepared Norco full pages, using overlapping tiles.
Run from rf_detr: python predict_norco_v2.py
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


def edge_sides(box, origin, size, margin=4):
    x,y=origin; w,h=size
    return [side for side,flag in enumerate((
        x>0 and box[0]-x<=margin,
        y>0 and box[1]-y<=margin,
        x+TILE<w and x+TILE-box[2]<=margin,
        y+TILE<h and y+TILE-box[3]<=margin)) if flag]


def confirms(fragment, complete):
    """Require containment AND agreement after clipping the complete box to its source tile.
    No annotation data is used to decide whether detections are duplicates.
    """
    if not fragment['edges'] or complete['edges']:
        return False
    a=np.array(fragment['box']); b=np.array(complete['box'])
    area=np.prod(a[2:]-a[:2])
    inter=np.maximum(np.minimum(a[2:],b[2:])-np.maximum(a[:2],b[:2]),0).prod()
    if area<=0 or inter/area<.85:
        return False
    x,y=fragment['origin']; bounds=np.array([x,y,x+TILE,y+TILE])
    # A replacement must extend through each edge that clipped the fragment.
    if not all((b[k]<bounds[k]-4 if k<2 else b[k]>bounds[k]+4) for k in fragment['edges']):
        return False
    clipped=np.r_[np.maximum(b[:2],bounds[:2]),np.minimum(b[2:],bounds[2:])]
    return bool(ious(a,clipped.reshape(1,4))[0]>=.5)


def detect_tile(model,page,origin,threshold):
    x,y=origin;w,h=page.size
    tile=Image.new('RGB',(TILE,TILE),'white')
    tile.paste(page.crop((x,y,min(x+TILE,w),min(y+TILE,h))),(0,0))
    d=model.predict(tile,threshold=threshold)
    result=[]
    for box,score in zip(d.xyxy,d.confidence):
        box=np.array(box,dtype=float)+np.array([x,y,x,y])
        box[[0,2]]=np.clip(box[[0,2]],0,w);box[[1,3]]=np.clip(box[[1,3]],0,h)
        if np.isfinite(box).all() and np.isfinite(score) and np.all(box[2:]>box[:2]):
            result.append({'box':box.tolist(),'score':float(score),'origin':list(origin),
                           'edges':edge_sides(box,origin,page.size)})
    return result


def evaluate(records,truth,nms_iou,match_iou):
    boxes=np.array([r['box'] for r in records],float).reshape(-1,4)
    scores=np.array([r['score'] for r in records],float)
    keep=nms(boxes,scores,nms_iou);boxes=boxes[keep];scores=scores[keep]
    mp,mt=match_boxes(boxes,scores,truth,match_iou)
    result={'labels':len(truth),'predictions':len(boxes),'matches':len(mp),
            'unmatched':len(boxes)-len(mp),'missed_labels':len(truth)-len(mt),
            'precision':len(mp)/len(boxes) if len(boxes) else None,
            'recall':len(mt)/len(truth) if len(truth) else None}
    return result,boxes,scores,mp,mt,[records[i] for i in keep]


def main():
    p=argparse.ArgumentParser(description='Norco boundary-recheck experiment; no training. Standalone script.')
    p.add_argument('--checkpoint',type=Path,default=Path('outputs/doors_commercial_v1/checkpoint_best_ema.pth'))
    p.add_argument('--pages',type=Path,default=Path('doors_commercial_v1/data/full_pages/valid'))
    p.add_argument('--output',type=Path)
    p.add_argument('--threshold',type=float,default=.3)
    p.add_argument('--nms-iou',type=float,default=.5)
    p.add_argument('--match-iou',type=float,default=.5)
    p.add_argument('--device',choices=['mps','cpu','cuda'],default='mps')
    args=p.parse_args()
    for name in ('threshold','nms_iou','match_iou'):
        if not 0<getattr(args,name)<=1:p.error(f'{name} must be in (0,1]')
    if not args.checkpoint.is_file():p.error('Checkpoint missing; run from your rf_detr folder.')
    ap=args.pages/'_annotations.coco.json'
    if not ap.is_file():p.error(f'Annotations missing: {ap}')
    data=json.loads(ap.read_text())
    if {c['name'] for c in data['categories']}!={'door'}:p.error('Expected one class: door')
    for item in data['images']:
        if not (args.pages/item['file_name']).is_file():p.error(f'Missing {item["file_name"]}')
    out=args.output or Path('outputs')/('norco_review_v2_'+datetime.now().strftime('%Y%m%d_%H%M%S'))
    if out.exists() and any(out.iterdir()):p.error('Output is nonempty; choose a new folder.')
    import torch
    from rfdetr import RFDETRSmall
    if args.device=='mps' and not torch.backends.mps.is_available():p.error('MPS unavailable; use --device cpu.')
    if args.device=='cuda' and not torch.cuda.is_available():p.error('CUDA unavailable.')
    print('Loading checkpoint...',flush=True)
    model=RFDETRSmall(pretrain_weights=str(args.checkpoint.resolve()),num_classes=1,resolution=512,device=args.device)
    out.mkdir(parents=True,exist_ok=True)
    grouped=defaultdict(list)
    for a in data['annotations']:
        x,y,w,h=a['bbox'];grouped[a['image_id']].append([x,y,x+w,y+h])
    report={'checkpoint':str(args.checkpoint.resolve()),'threshold':args.threshold,
            'nms_iou':args.nms_iou,'match_iou':args.match_iou,'tile_size':TILE,'stride':STRIDE,
            'note':'Controlled boundary-recheck experiment, not mAP. Unconfirmed edge boxes are retained. Visually inspect losses and duplicate merges.', 'pages':[]}
    with torch.inference_mode():
        for item in data['images']:
            with Image.open(args.pages/item['file_name']) as src:page=src.convert('RGB')
            w,h=page.size
            if (w,h)!=(item['width'],item['height']):raise ValueError('Image dimensions differ from annotation dimensions')
            grid=[(x,y) for y in positions(h) for x in positions(w)]
            cache={};raw=[]
            print(f'\n{item["file_name"]}: {len(grid)} initial tiles',flush=True)
            for n,origin in enumerate(grid,1):
                cache[origin]=detect_tile(model,page,origin,args.threshold);raw.extend(cache[origin])
                if n%20==0 or n==len(grid):print(f'  Initial {n}/{len(grid)}',flush=True)
            fragments=[r for r in raw if r['edges']]
            complete=[r for r in raw if not r['edges']]
            pending=[r for r in fragments if not any(confirms(r,c) for c in complete)]
            origins=set()
            for r in pending:
                b=r['box'];cx=(b[0]+b[2])/2;cy=(b[1]+b[3])/2
                origins.add((int(np.clip(round((cx-TILE/2)/32)*32,0,max(0,w-TILE))),
                             int(np.clip(round((cy-TILE/2)/32)*32,0,max(0,h-TILE)))))
            origins=sorted(origins-set(cache))
            print(f'  Rechecking {len(origins)} shifted crops',flush=True)
            added=[]
            for n,origin in enumerate(origins,1):
                ds=detect_tile(model,page,origin,args.threshold)
                # Add only interior detections that geometrically confirm an original fragment.
                added.extend(c for c in ds if not c['edges'] and any(confirms(r,c) for r in pending))
                if n%20==0 or n==len(origins):print(f'  Recheck {n}/{len(origins)}',flush=True)
            candidates=complete+added
            removed=[i for i,r in enumerate(raw) if r['edges'] and any(confirms(r,c) for c in candidates)]
            removed_set=set(removed)
            revised=[r for i,r in enumerate(raw) if i not in removed_set]+added
            truth=np.array(grouped[item['id']],float).reshape(-1,4)
            base=evaluate(raw,truth,args.nms_iou,args.match_iou)
            updated=evaluate(revised,truth,args.nms_iou,args.match_iou)
            stem=Path(item['file_name']).stem
            render(page,base[1],base[2],truth,base[3],base[4],out,stem+'_baseline')
            render(page,updated[1],updated[2],truth,updated[3],updated[4],out,stem+'_v2')
            entry={'file':item['file_name'],'baseline':base[0],'v2':updated[0],
                   'raw_boundary_candidates':len(fragments),'extra_crops':len(origins),
                   'suppressed_raw_fragments':len(removed),'added_raw_confirmations':len(added),
                   'baseline_detections':base[5],'v2_detections':updated[5],
                   'removed_fragments':[raw[i] for i in removed]}
            report['pages'].append(entry)
            (out/'comparison.json').write_text(json.dumps(report,indent=2))
            print('  Baseline:',base[0],flush=True);print('  V2:      ',updated[0],flush=True)
    (out/'README.txt').write_text('Compare baseline and v2 PNGs. GREEN matched prediction; ORANGE unmatched prediction; BLUE matched annotation; MAGENTA missed annotation.\nUnmatched is not necessarily a wrong object. Check actual door identity and box size.\nBoundary detections are suppressed only with geometric support from an interior prediction. Unsupported candidates remain. This heuristic can still merge neighboring doors; inspect recall losses.\nAnnotations are used only to evaluate and draw results, never to select predictions. Threshold and checkpoint are unchanged between methods.\nThis is an experiment: do not replace the baseline unless image review supports the change.\n')
    print(f'\nSaved: {out.resolve()}\nSend comparison.json and the two *_v2_review.png images.',flush=True)


if __name__=='__main__':main()
