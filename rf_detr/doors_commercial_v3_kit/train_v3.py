"""Fine-tune RF-DETR Small from the best v2 door weights, using v3 data."""
import argparse
from importlib.metadata import PackageNotFoundError, version
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', type=Path, default=Path('outputs/doors_commercial_v2/checkpoint_best_ema.pth'))
    parser.add_argument('--dataset', type=Path, default=HERE / 'data')
    parser.add_argument('--output', type=Path, default=Path('outputs/doors_commercial_v3'))
    parser.add_argument('--epochs', type=int, default=5)
    parser.add_argument('--device', choices=['mps', 'cuda', 'cpu'], default='mps')
    parser.add_argument('--check-only', action='store_true', help='Check data/checkpoint paths without loading the model or training.')
    args = parser.parse_args()
    if not args.checkpoint.is_file():
        parser.error(f'Checkpoint missing: {args.checkpoint}')
    if args.epochs < 1:
        parser.error('--epochs must be positive')
    for split in ('train', 'valid', 'test'):
        if not (args.dataset / split / '_annotations.coco.json').is_file():
            parser.error(f'Dataset missing {split}; run prepare_v3.py first.')
    report_path = args.dataset / 'preparation_report.json'
    if not report_path.is_file():
        parser.error('Preparation report missing; run prepare_v3.py first.')
    report = json.loads(report_path.read_text())
    if report.get('version') != 3 or report.get('holdout', {}).get('used_for_training') is not False:
        parser.error('This is not the prepared v3 dataset.')
    if args.output.exists() and (not args.output.is_dir() or any(args.output.iterdir())):
        parser.error('Output is not an empty folder. Choose a new --output folder.')
    if args.output.resolve().is_relative_to(args.dataset.resolve()):
        parser.error('Training output must be outside the prepared dataset.')
    print(f'Training pages: {report["train"]["pages"]}; eligible doors: {report["train"]["eligible_source_labels"]}', flush=True)
    print('Validation: Norco. Wieden and UC Davis are not used for training.', flush=True)
    if args.check_only:
        print('Data and checkpoint paths passed. Model loading/training were not run.', flush=True)
        return
    try:
        installed = version('rfdetr')
    except PackageNotFoundError:
        parser.error('RF-DETR is missing in this interpreter. Run: .venv/bin/python -m pip install "rfdetr==1.11.2"')
    if installed != '1.11.2':
        parser.error(f'This kit targets your working RF-DETR 1.11.2; found {installed}. Use that environment.')
    import torch
    from rfdetr import RFDETRSmall
    if args.device == 'mps' and not torch.backends.mps.is_available():
        parser.error('MPS unavailable. Use your working Mac environment or pass --device cpu.')
    if args.device == 'cuda' and not torch.cuda.is_available():
        parser.error('CUDA unavailable.')
    print(f'RF-DETR {installed} | device={args.device} | epochs={args.epochs}', flush=True)
    print('Starting new fine-tuning from v2 weights; optimizer starts fresh.', flush=True)
    model = RFDETRSmall(num_classes=1, resolution=512,
                       pretrain_weights=str(args.checkpoint.resolve()))
    model.train(dataset_dir=str(args.dataset.resolve()), output_dir=str(args.output.resolve()),
                epochs=args.epochs, batch_size=1, grad_accum_steps=4, device=args.device,
                num_workers=0, lr=5e-5, lr_encoder=5e-5, multi_scale=False,
                expanded_scales=False, use_ema=True, run_test=False, seed=42)


if __name__ == '__main__':
    main()
