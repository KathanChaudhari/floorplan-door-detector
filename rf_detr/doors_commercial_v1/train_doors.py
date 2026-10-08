"""Fine-tune the existing RF-DETR Small door checkpoint on the prepared tiles."""
import argparse
from importlib.metadata import version
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--dataset', type=Path, default=Path(__file__).resolve().parent / 'data')
    parser.add_argument('--output', type=Path, default=Path('outputs/doors_commercial_v1'))
    parser.add_argument('--epochs', type=int, default=5)
    parser.add_argument('--device', choices=['mps', 'cuda', 'cpu'], default='mps')
    args = parser.parse_args()
    if not args.checkpoint.is_file():
        parser.error(f'Checkpoint not found: {args.checkpoint}')
    if args.epochs < 1:
        parser.error('--epochs must be positive')
    for split in ('train', 'valid', 'test'):
        if not (args.dataset / split / '_annotations.coco.json').is_file():
            parser.error(f'Missing COCO file for {split}: {args.dataset}')
    if args.output.exists() and any(args.output.iterdir()):
        parser.error('Output folder is not empty. Use --output with a new folder name.')
    import torch
    from rfdetr import RFDETRSmall
    if args.device == 'mps' and not torch.backends.mps.is_available():
        parser.error('MPS is unavailable. Activate your working Mac environment or use --device cpu.')
    if args.device == 'cuda' and not torch.cuda.is_available():
        parser.error('CUDA is unavailable.')
    print(f'RF-DETR {version("rfdetr")} | device={args.device}', flush=True)
    print(f'Dataset: {args.dataset.resolve()}', flush=True)
    print(f'Output: {args.output.resolve()}', flush=True)
    model = RFDETRSmall(num_classes=1, resolution=512,
                       pretrain_weights=str(args.checkpoint.resolve()))
    model.train(
        dataset_dir=str(args.dataset.resolve()),
        output_dir=str(args.output.resolve()),
        epochs=args.epochs,
        batch_size=1,
        grad_accum_steps=4,
        device=args.device,
        num_workers=0,
        lr=1e-4,
        multi_scale=False,
        expanded_scales=False,
        run_test=False,
        seed=42,
    )


if __name__ == '__main__':
    main()
