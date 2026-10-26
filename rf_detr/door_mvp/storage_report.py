"""Read-only disk inventory. Never deletes, moves or modifies files."""
import argparse
from collections import defaultdict
import json
import os
from pathlib import Path

HERE=Path(__file__).resolve().parent


def human(n):
    for suffix in ('B','KiB','MiB','GiB','TiB'):
        if n<1024 or suffix=='TiB': return f'{n:.1f} {suffix}'
        n/=1024


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(os.environ.get('DOOR_PROJECT_ROOT',HERE.parent)))
    p.add_argument('--top',type=int,default=20)
    args=p.parse_args(); root=args.root.resolve()
    config=json.loads((HERE/'config.json').read_text())
    protected={(root/path).resolve() for path in config['models'].values()}
    totals=defaultdict(int); files=[]; skipped=[]
    for folder,dirs,names in os.walk(root,followlinks=False):
        dirs[:]=[d for d in dirs if d not in ('.venv','.git','node_modules','__pycache__') and not (Path(folder)/d).is_symlink()]
        for name in names:
            path=Path(folder)/name
            if path.is_symlink(): continue
            try:
                size=path.stat().st_size; rel=path.relative_to(root)
                totals[rel.parts[0] if len(rel.parts)>1 else '(root files)']+=size
                files.append((size,str(rel),path.resolve() in protected))
            except OSError: skipped.append(str(path))
    print('READ-ONLY inventory. Nothing was deleted, moved or changed.')
    print('Excluded: .venv, .git, node_modules, __pycache__, and symbolic links.')
    print('\nKEEP these configured checkpoints:')
    for path in sorted(protected): print(('FOUND  ' if path.is_file() else 'MISSING'),path)
    print('\nLargest project folders (not deletion recommendations):')
    for name,size in sorted(totals.items(),key=lambda x:x[1],reverse=True)[:args.top]: print(f'{human(size):>12}  {name}')
    print('\nLargest files:')
    for size,name,keep in sorted(files,reverse=True)[:args.top]: print(f'{human(size):>12}  {"KEEP CHECKPOINT: " if keep else ""}{name}')
    print('\nArchive training images, annotations, licenses, preparation/training scripts, configs and benchmark reports before removing working copies.')
    print('Generated tiles/old prediction PNGs are reproducible only if source data, labels, code and the relevant checkpoint remain available.')
    print('Full optimizer checkpoints are needed for an exact training resume. The best EMA checkpoint is sufficient for inference.')
    print('door_mvp/sessions contains uploaded PDFs and saved reviews needed to reopen those reviews. It is separate from training data.')
    if skipped: print(f'Could not read {len(skipped)} files.')


if __name__=='__main__': main()
