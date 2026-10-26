"""Local door review MVP. Run one server worker; datasets are never loaded."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import csv
import gc
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import threading
import time
import uuid

import pymupdf
from PIL import Image
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('DOOR_PROJECT_ROOT', HERE.parent)).resolve()
STORE = Path(os.environ.get('DOOR_MVP_DATA', HERE / 'sessions')).resolve()
CONFIG = json.loads((HERE / 'config.json').read_text())
LOCK, PDF_LOCK = threading.RLock(), threading.RLock()
POOL = ThreadPoolExecutor(max_workers=1)
BUSY = False
CACHED = None


def write(path, value):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, indent=2) + '\n')
    tmp.replace(path)


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1024*1024), b''): h.update(b)
    return h.hexdigest()


def folder(job):
    if not re.fullmatch(r'[a-f0-9]{32}', job): raise HTTPException(404, 'Document not found.')
    p = STORE / job
    if not (p / 'job.json').is_file(): raise HTTPException(404, 'Document not found.')
    return p


def load(job): return json.loads((folder(job) / 'job.json').read_text())
def persist(data): write(folder(data['id']) / 'job.json', data)


def page_of(data, number):
    if number < 1 or number > len(data['pages']): raise HTTPException(404, 'Page not found.')
    return data['pages'][number-1]


def weights(model):
    if model not in ('v3', 'v4'): raise HTTPException(400, 'Choose v3 or v4.')
    return (ROOT / CONFIG['models'][model]).resolve()


def idle(data):
    if data['status'] in ('queued', 'running'): raise HTTPException(409, 'Wait for detection to finish.')


def render_page(job, number):
    with LOCK:
        data = load(job)
        p = page_of(data, number)
        path = folder(job) / f'page_{number}.png'
        if path.exists(): return path
        with PDF_LOCK, pymupdf.open(folder(job) / 'source.pdf') as doc:
            page = doc[number-1]
            dpi = data.get('dpi',CONFIG['dpi'])
            estimate = math.ceil(page.rect.width*dpi/72)*math.ceil(page.rect.height*dpi/72)
            if estimate > CONFIG['max_render_pixels']:
                raise HTTPException(413, 'This sheet is too large at 150 DPI. Crop a copy of the PDF before uploading.')
            pix = page.get_pixmap(dpi=dpi, colorspace=pymupdf.csRGB, alpha=False)
            pix.save(path)
            p.update(width=pix.width, height=pix.height)
        persist(data)
        return path


def get_model(key):
    global CACHED
    from importlib.metadata import version
    if version('rfdetr') != '1.11.2': raise RuntimeError('Use the working RF-DETR 1.11.2 environment.')
    import torch
    from rfdetr import RFDETRSmall
    path = weights(key)
    stamp = (str(path), path.stat().st_size, path.stat().st_mtime_ns)
    if CACHED and CACHED[0] == stamp: return CACHED[1], CACHED[2]
    CACHED = None  # keep only one model in memory on the MacBook Air
    gc.collect()
    if torch.backends.mps.is_available(): torch.mps.empty_cache()
    if CONFIG['device'] == 'mps' and not torch.backends.mps.is_available():
        raise RuntimeError('MPS unavailable. Use the working Mac environment, or set device=cpu in config.json.')
    model = RFDETRSmall(pretrain_weights=str(path), num_classes=1, resolution=512, device=CONFIG['device'])
    provenance = dict(model=key, checkpoint=str(path), checkpoint_sha256=sha(path), rfdetr='1.11.2',
                      threshold=CONFIG['threshold'], nms_iou=CONFIG['nms_iou'], tile_size=768, stride=384)
    CACHED = (stamp, model, provenance)
    return model, provenance


def run_detection(job, numbers, key):
    global BUSY
    try:
        with LOCK:
            data = load(job); data.update(status='running', message=f'Loading {key}…'); persist(data)
            settings = data.get('inference_settings',CONFIG)
        model, provenance = get_model(key)
        provenance = {**provenance,'threshold':settings['threshold'],'nms_iou':settings['nms_iou']}
        import torch
        from inference_engine import detect_page
        for index, number in enumerate(numbers, 1):
            with LOCK:
                data = load(job); data['message'] = f'{key}: sheet {number} ({index}/{len(numbers)})'; persist(data)
            path = render_page(job, number)
            start = time.perf_counter()
            with Image.open(path) as image, torch.inference_mode():
                records, details = detect_page(model, image.convert('RGB'), settings['threshold'], settings['nms_iou'])
            boxes = [dict(id=uuid.uuid4().hex, box=r['box'], score=r['score'], source=key) for r in records]
            result = dict(boxes=boxes, model=provenance, processing=details, seconds=time.perf_counter()-start)
            with LOCK:
                data = load(job); p = page_of(data, number)
                write(folder(job) / f'raw_{key}_page_{number}.json', result)
                if key == 'v3':
                    p.update(boxes=boxes, reviewed=False, detected=True, base_model=provenance, revision=p['revision']+1)
                else:
                    p['reference'] = result  # never overwrite v3 boxes, edits, review or count
                persist(data)
        with LOCK:
            data = load(job); data.update(status='ready', message='Detection finished. Review each selected sheet.'); persist(data)
    except Exception as error:
        with LOCK:
            data = load(job); data.update(status='error', message=str(error)); persist(data)
    finally:
        with LOCK: BUSY = False


@asynccontextmanager
async def lifespan(app):
    STORE.mkdir(parents=True, exist_ok=True)
    with LOCK:
        for path in STORE.glob('*/job.json'):
            try:
                data = json.loads(path.read_text())
                if data['status'] in ('queued','running'):
                    data.update(status='interrupted', message='Server stopped during detection. Completed sheets were preserved.')
                    write(path, data)
            except (ValueError,KeyError): pass
    yield


app = FastAPI(title='Door Review — local MVP', lifespan=lifespan)


@app.middleware('http')
async def local_origin(request: Request, call_next):
    origin = request.headers.get('origin')
    if origin and origin not in (f'http://127.0.0.1:{request.url.port or 80}', f'http://localhost:{request.url.port or 80}'):
        return Response('Origin not allowed.', status_code=403)
    return await call_next(request)


@app.get('/api/config')
def configuration():
    return dict(default_model='v3', reference_model='v4', device=CONFIG['device'], dpi=CONFIG['dpi'],
                available={key:weights(key).is_file() for key in ('v3','v4')})


@app.get('/api/jobs')
def jobs():
    STORE.mkdir(parents=True, exist_ok=True)
    result=[]
    with LOCK:
        for path in sorted(STORE.glob('*/job.json'),key=lambda p:p.stat().st_mtime,reverse=True):
            try:
                d=json.loads(path.read_text()); result.append(dict(id=d['id'],name=d['name'],pages=len(d['pages'])))
            except (ValueError,KeyError): pass
    return result[:30]


@app.post('/api/jobs')
def upload(file: UploadFile = File(...)):
    STORE.mkdir(parents=True, exist_ok=True)
    job=uuid.uuid4().hex; dest=STORE/job; dest.mkdir()
    try:
        size=0
        with (dest/'source.pdf').open('wb') as target:
            for chunk in iter(lambda:file.file.read(1024*1024),b''):
                size+=len(chunk)
                if size>250*1024*1024: raise HTTPException(413,'Use a PDF smaller than 250 MB.')
                target.write(chunk)
        pages=[]
        with PDF_LOCK,pymupdf.open(dest/'source.pdf') as doc:
            if not doc.is_pdf or doc.needs_pass or len(doc)<1:
                raise HTTPException(400,'Provide an unlocked PDF with at least one page.')
            for i,page in enumerate(doc):
                pages.append(dict(number=i+1,point_size=list(page.rect.br-page.rect.tl), width=None,height=None,
                    boxes=[],detected=False,reviewed=False,revision=0,reference=None,base_model=None))
        data=dict(id=job,name=Path(file.filename or 'plan.pdf').name,status='ready',message='Select enlarged floor-plan sheets.',
                  dpi=CONFIG['dpi'],inference_settings={key:CONFIG[key] for key in ('threshold','nms_iou')},
                  source_sha256=sha(dest/'source.pdf'),selected_pages=[],pages=pages)
        write(dest/'job.json',data)
        return data
    except HTTPException:
        shutil.rmtree(dest); raise
    except Exception:
        shutil.rmtree(dest); raise HTTPException(400,'Could not read this file as a PDF.')
    finally: file.file.close()


@app.get('/api/jobs/{job}')
def get_job(job:str):
    with LOCK: return load(job)


@app.get('/api/jobs/{job}/pages/{number}/image')
def image(job:str,number:int): return FileResponse(render_page(job,number),media_type='image/png')


class Selection(BaseModel):
    pages:list[int]


@app.put('/api/jobs/{job}/selection')
def selection(job:str,body:Selection):
    with LOCK:
        data=load(job); idle(data)
        for number in body.pages: page_of(data,number)
        data['selected_pages']=sorted(set(body.pages)); persist(data); return data


class Detection(BaseModel):
    model:str='v3'


@app.post('/api/jobs/{job}/detect',status_code=202)
def detect(job:str,body:Detection):
    global BUSY
    key=body.model
    checkpoint=weights(key)
    if not checkpoint.is_file(): raise HTTPException(400,f'{key} checkpoint is missing. Check config.json.')
    with LOCK:
        data=load(job); idle(data)
        if BUSY: raise HTTPException(409,'Another document is being processed. Wait for it to finish.')
        numbers=[n for n in data['selected_pages'] if not (page_of(data,n)['detected'] if key=='v3' else page_of(data,n)['reference'])]
        if not numbers: raise HTTPException(400,'Select sheets that have not yet been processed by this model.')
        # Existing manually corrected v3 boxes must never be replaced by model proposals.
        if key=='v3' and any(page_of(data,n)['boxes'] or page_of(data,n)['reviewed'] or page_of(data,n)['revision']>0 for n in numbers):
            raise HTTPException(409,'A selected sheet already has manual edits. Keep those edits, or use a new document session.')
        BUSY=True; data.update(status='queued',message=f'{key} queued…'); persist(data)
        POOL.submit(run_detection,job,numbers,key)
        return data


class Box(BaseModel):
    id:str=Field(min_length=1,max_length=100)
    box:list[float]=Field(min_length=4,max_length=4)
    score:float|None=None
    source:str='manual'


class Edit(BaseModel):
    revision:int
    boxes:list[Box]
    reviewed:bool=False


@app.put('/api/jobs/{job}/pages/{number}')
def edit(job:str,number:int,body:Edit):
    render_page(job,number)
    with LOCK:
        data=load(job); idle(data); p=page_of(data,number)
        if body.revision!=p['revision']: raise HTTPException(409,'This sheet changed in another tab. Reload the document.')
        ids=set(); boxes=[]
        for item in body.boxes:
            x,y,x2,y2=item.box
            if (item.id in ids or not all(math.isfinite(v) for v in item.box)
                    or not 0<=x<x2<=p['width'] or not 0<=y<y2<=p['height']
                    or item.score is not None and (not math.isfinite(item.score) or not 0<=item.score<=1)):
                raise HTTPException(400,'Every box needs a unique ID and valid bounds inside the sheet.')
            ids.add(item.id)
            boxes.append(dict(id=item.id,box=item.box,score=item.score,source=item.source if item.source in ('v3','manual','edited','merged') else 'manual'))
        p.update(boxes=boxes,reviewed=body.reviewed,revision=p['revision']+1)
        persist(data); return p


@app.get('/api/jobs/{job}/export/{kind}')
def export(job:str,kind:str):
    with LOCK:
        data=load(job); idle(data)
        chosen=[page_of(data,n) for n in data['selected_pages']]
        if not chosen or any(not p['reviewed'] for p in chosen):
            raise HTTPException(409,'Confirm review for every selected sheet before exporting.')
        payload=dict(document=data['name'],source_sha256=data['source_sha256'],default_model='v3',
            counting_rule='One reviewed opening per box; double leaves are one opening.',
            coordinate_system='Rendered-page pixels, top-left origin; x right, y down.',dpi=data.get('dpi',CONFIG['dpi']),
            reviewed_openings_on_selected_sheets=sum(len(p['boxes']) for p in chosen),
            note='Counts across selected sheets do not deduplicate repeated drawings or levels automatically.',
            pages=[dict(page=p['number'],width=p['width'],height=p['height'],count=len(p['boxes']),
                        reviewed=True,boxes=p['boxes'],base_model=p['base_model']) for p in chosen])
    headers={'Content-Disposition':f'attachment; filename="door_review.{kind}"'}
    if kind=='json': return Response(json.dumps(payload,indent=2),media_type='application/json',headers=headers)
    if kind=='csv':
        s=io.StringIO(newline=''); w=csv.writer(s)
        w.writerow(['page','reviewed_page_count','opening_id','x1_px','y1_px','x2_px','y2_px','confidence','source'])
        for p in chosen:
            if not p['boxes']: w.writerow([p['number'],0,'','','','','','','reviewed_zero'])
            for b in p['boxes']: w.writerow([p['number'],len(p['boxes']),b['id'],*b['box'],b['score'],b['source']])
        return Response(s.getvalue(),media_type='text/csv',headers=headers)
    if kind=='pdf':
        # Flatten selected sheets so rotation/crop coordinates match the displayed raster exactly.
        with PDF_LOCK,pymupdf.open() as result:
            for p in chosen:
                pw,ph=p['point_size']; dest=result.new_page(width=pw,height=ph)
                dest.insert_image(dest.rect,filename=str(folder(job)/f'page_{p["number"]}.png'))
                sx,sy=pw/p['width'],ph/p['height']
                for i,b in enumerate(p['boxes'],1):
                    x,y,x2,y2=b['box']; dest.draw_rect(pymupdf.Rect(x*sx,y*sy,x2*sx,y2*sy),color=(0,.35,.95),width=1)
                    dest.insert_text((x*sx,max(9,y*sy-2)),str(i),fontsize=8,color=(0,.25,.8))
                dest.insert_text((12,14),f'Reviewed sheet {p["number"]}: {len(p["boxes"])} openings',fontsize=10,color=(0,.25,.8))
            content=result.tobytes(garbage=4,deflate=True)
        return Response(content,media_type='application/pdf',headers=headers)
    raise HTTPException(404,'Choose json, csv or pdf.')


app.mount('/',StaticFiles(directory=HERE/'static',html=True),name='interface')


if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=8765,workers=1)
