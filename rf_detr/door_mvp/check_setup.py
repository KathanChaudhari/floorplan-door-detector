"""Check the local MVP environment without loading model tensors or datasets."""
from importlib.metadata import version
import json
import os
from pathlib import Path
import sys

here=Path(__file__).resolve().parent
root=Path(os.environ.get('DOOR_PROJECT_ROOT',here.parent)).resolve()
config=json.loads((here/'config.json').read_text())
ok=True
print('Python:',sys.version.split()[0])
for name in ('rfdetr','torch','numpy','Pillow','PyMuPDF','fastapi','uvicorn','python-multipart'):
    try:
        installed=version(name); print(name,installed)
        if name=='rfdetr' and installed!='1.11.2': print('Use your RF-DETR 1.11.2 environment.'); ok=False
    except Exception:
        print('MISSING:',name); ok=False
for key,name in config['models'].items():
    path=(root/name).resolve(); found=path.is_file()
    print(key,'FOUND' if found else 'MISSING',path)
    if key=='v3' and not found: ok=False
try:
    import torch
    print('Configured device:',config['device'],'| MPS available:',torch.backends.mps.is_available())
    if config['device']=='mps' and not torch.backends.mps.is_available(): ok=False
except ImportError: ok=False
print('Default: v3. Reference: v4. No training dataset is loaded.')
origins=[value.strip() for value in os.environ.get('DOOR_MVP_DEV_ORIGINS','').split(',') if value.strip()]
print('API: http://127.0.0.1:8765 | API docs: http://127.0.0.1:8765/docs')
print('React frontend: http://127.0.0.1:5173 (run npm run dev in frontend/ separately).')
print('Additional allowed development origins:', ', '.join(origins) if origins else '(none configured)')
if not origins:
    print('For Vite development, set DOOR_MVP_DEV_ORIGINS=http://127.0.0.1:5173,http://localhost:5173 before starting the API.')
print('PASS: paths/packages checked; actual checkpoint loading still occurs during detection.' if ok else 'Resolve the missing items above before detection.')
raise SystemExit(0 if ok else 1)
