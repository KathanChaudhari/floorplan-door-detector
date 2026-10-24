# Commercial doors v3: new independent projects

This kit includes the seven images and 479 boxes from your project-9 export.
It adds TownePlace and UCCS to your existing v2 training set. Wieden Hall stays
separate as a new-project evaluation set. No more labeling is required before
this experiment.

## Run on your Mac

1. Unzip `doors_commercial_v3_kit.zip`.
2. Put the extracted `doors_commercial_v3_kit` folder directly inside:
   `/Users/kathan/Projects/floorplan-door-detector/rf_detr/`
3. In Terminal, run:

```bash
cd /Users/kathan/Projects/floorplan-door-detector/rf_detr
source .venv/bin/activate
.venv/bin/python doors_commercial_v3_kit/prepare_v3.py
.venv/bin/python doors_commercial_v3_kit/train_v3.py
```

Run preparation first and wait for its success message before starting training.
The seven new images are already bundled; do not import or label them again.

Preparation expects the previously prepared dataset at
`doors_commercial_v2_kit/data`. It checks the six v2 annotation files against
the audited version and checks that every referenced old image exists. It
also checks the bundled new images, dimensions, and box coordinates. If your
v2 data is elsewhere, use:

```bash
.venv/bin/python doors_commercial_v3_kit/prepare_v3.py --v2-data /actual/path/to/v2/data
```

If RF-DETR is missing, install it into this exact virtual environment:

```bash
.venv/bin/python -m pip install "rfdetr==1.11.2"
```

If Pillow is missing during preparation:

```bash
.venv/bin/python -m pip install Pillow
```

Use your existing RF-DETR 1.11.2 environment for this run; the kit checks that
version before loading the model. There is no need to upgrade a working setup.

## What the scripts do

| Role | Projects | Full pages | Source labels |
| --- | --- | ---: | ---: |
| Existing training | ASC, GVHC Stockton, Greenville | 10 | 319 audit labels; 318 eligible |
| Added training | TownePlace, UCCS | 5 | 385 |
| Validation during training | Norco | 2 | 100 |
| New-project evaluation after training | Wieden Hall | 2 | 94 |
| Reserved final test | UC Davis | 2 | 92 |

Training therefore contains 15 full pages from five projects and 703 eligible
source door labels. The full-page annotation file retains all 704 audit labels:
the ambiguous ASC label excluded in v2 remains excluded from training tiles.
Overlapping tiles contain repeated views of these labels; their annotation
count is not a count of independent doors.

`prepare_v3.py` preserves the existing v2 tiles, including its reviewed hard
examples and exclusions. For new training pages it makes overlapping crops
starting at 768 pixels with a 384-pixel stride, adds a crop centered on each
door, and expands crops to include complete intersecting door boxes. It adds
some annotated-background crops with no doors, up to one per three positive
crops. Every new source label must appear fully in at least one training crop.
The code assumes the new pages were fully reviewed; a missed label remains
missing and cannot be repaired by tiling.

Old and new image files are hard-linked when possible to save disk space;
copying is the fallback. Treat prepared image files as read-only. The scripts
write independent annotation files and never overwrite an existing output
dataset. They preserve the existing Norco validation and UC Davis test tiles.
Wieden appears only in `data/full_pages/holdout`, outside the training splits.

`train_v3.py` starts a new fine-tuning run from:

`outputs/doors_commercial_v2/checkpoint_best_ema.pth`

It uses RFDETRSmall, one class `door`, resolution 512, MPS, batch size 1,
gradient accumulation 4, learning rates 5e-5, and five initial epochs. These
match the working v2 setup. It starts fresh optimizer state; it does not
resume the old epoch counter. Wieden is not used to choose the best epoch.

Optional data/checkpoint path preflight, without loading the model:

```bash
.venv/bin/python doors_commercial_v3_kit/train_v3.py --check-only
```

## Outputs and next evaluation

Preparation writes `doors_commercial_v3_kit/data/preparation_report.json`.
Training writes a separate folder `outputs/doors_commercial_v3/`.
The intended candidate checkpoint is:

`outputs/doors_commercial_v3/checkpoint_best_ema.pth`

The best EMA checkpoint is chosen by Norco validation performance, rather
than automatically using the last epoch. Keep the v2 checkpoint as a baseline;
new data can help, but improvement has to be measured.

After training, send the training log. Using the `predict_norco_v2.py` script
already in your project, run both checkpoints on Wieden with identical settings:

```bash
.venv/bin/python predict_norco_v2.py --checkpoint outputs/doors_commercial_v2/checkpoint_best_ema.pth --pages doors_commercial_v3_kit/data/full_pages/holdout
.venv/bin/python predict_norco_v2.py --checkpoint outputs/doors_commercial_v3/checkpoint_best_ema.pth --pages doors_commercial_v3_kit/data/full_pages/holdout
```

That review script is from your earlier setup and is not included in this kit.
Keep the two timestamped output folders and send their `comparison.json` and
review PNGs. Also compare Norco using the same script/settings:

```bash
.venv/bin/python predict_norco_v2.py --checkpoint outputs/doors_commercial_v2/checkpoint_best_ema.pth --pages doors_commercial_v3_kit/data/full_pages/valid
.venv/bin/python predict_norco_v2.py --checkpoint outputs/doors_commercial_v3/checkpoint_best_ema.pth --pages doors_commercial_v3_kit/data/full_pages/valid
```

Unmatched predictions need visual review: they may be false detections,
duplicates, true doors missing from labels, or boxes with different extents.
These match counts are diagnostics, not COCO mAP. Do not train on the Wieden
review results while using it to report unseen-project performance. Leave
UC Davis untouched until the final model is selected.

RF-DETR references:
- https://rfdetr.roboflow.com/learn/train/
- https://pypi.org/project/rfdetr/1.11.2/

## Re-running safely

The scripts stop if their output already exists, preserving previous work.
For a deliberate separate experiment, choose fresh output paths:

```bash
.venv/bin/python doors_commercial_v3_kit/prepare_v3.py --output doors_commercial_v3_kit/data_run2
.venv/bin/python doors_commercial_v3_kit/train_v3.py --dataset doors_commercial_v3_kit/data_run2 --output outputs/doors_commercial_v3_run2
```
