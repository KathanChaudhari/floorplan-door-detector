"""Copy only the selected v3/v4 weights into this app; never remove originals."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile

HERE=Path(__file__).resolve().parent


def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()


def collect(config_path,root):
    config=json.loads(config_path.read_text()); destination=config_path.parent/'weights'
    selected={key:(root/name).resolve() for key,name in config['models'].items()}
    if not selected['v3'].is_file(): raise ValueError('V3 checkpoint missing. Original config was not changed.')
    destination.mkdir(exist_ok=True)
    for key,source in selected.items():
        if not source.is_file():
            print(f'{key}: unavailable; reference stays optional.'); continue
        target=destination/f'{key}.pth'; original=digest(source)
        if target.exists():
            if target.is_symlink() or digest(target)!=original:
                raise ValueError(f'{target} already exists with different contents; no overwrite.')
        else:
            temporary=None
            try:
                with tempfile.NamedTemporaryFile(dir=destination,prefix=key+'_',suffix='.tmp',delete=False) as f:
                    temporary=Path(f.name)
                    with source.open('rb') as opened: shutil.copyfileobj(opened,f,1024*1024)
                if digest(temporary)!=original: raise ValueError('Copy verification failed; config was not changed.')
                temporary.replace(target)
            finally:
                if temporary is not None: temporary.unlink(missing_ok=True)
        resolved=target.resolve()
        config['models'][key]=str(resolved.relative_to(root)) if resolved.is_relative_to(root) else str(resolved)
        print(f'{key}: verified copy at {target}')
    backup=config_path.with_name('config.before-weights.json')
    if not backup.exists():
        with backup.open('x') as f: f.write(config_path.read_text())
    temporary=config_path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(config,indent=2)+'\n');temporary.replace(config_path)
    print('Config updated. Original model files remain untouched. Restart the app and verify detection before archiving old outputs.')


if __name__=='__main__':
    try: collect(HERE/'config.json',Path(os.environ.get('DOOR_PROJECT_ROOT',HERE.parent)).resolve())
    except (OSError,ValueError,KeyError) as error: raise SystemExit(f'Stopped: {error}')
