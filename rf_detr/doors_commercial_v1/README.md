# Commercial door detection: first fine-tuning run

Use your existing working RF-DETR environment and door checkpoint. You do not need to label additional online plans before this first run.

## Run on your Mac

Extract this archive so the folder is:
`/Users/kathan/Projects/floorplan-door-detector/rf_detr/doors_commercial_v1`

Then run:

```bash
cd /Users/kathan/Projects/floorplan-door-detector/rf_detr
source .venv/bin/activate
python doors_commercial_v1/train_doors.py --checkpoint outputs/doors_trial/checkpoint_best_ema.pth --epochs 5
```

The script starts a new fine-tuning run from the checkpoint weights, with a fresh optimizer and schedule. It saves to `outputs/doors_commercial_v1` and refuses to overwrite a nonempty output folder. For another trial, use a fresh name, e.g. `--output outputs/doors_commercial_v2`.

Start with five epochs to check the training pipeline and validation trend. This is not a promise of convergence or production accuracy. Send the final training/validation log and any error traceback for the next decision. No model training was executed when preparing this package.

## Data and split

| Split | Projects | Full pages | Original door labels | Tiles |
|---|---|---:|---:|---:|
| Train | ASC, GVHC Stockton, Greenville | 10 | 316 | 898 |
| Validation | Norco | 2 | 100 | 352 |
| Test | UC Davis AIC | 2 | 92 | 352 |

All tiles from a page and project stay in one split. Keep UC Davis for the final evaluation after choosing settings using Norco. The script disables automatic test evaluation during this initial run.

Tiles are 768 x 768 pixels with a 384-pixel stride (50% overlap). RF-DETR Small uses 512-pixel model input in this initial configuration. Training includes all tiles intersecting a labeled door and a deterministic sample of tiles without labeled doors that contain drawing content. Validation and test include the full page grid, including background.

Overlapping tiles repeat labels: there are 1,787 training, 485 validation, and 478 test annotation instances. These are not additional unique doors. Boxes at tile boundaries are clipped to the tile; even small positive-area fragments retain labels. Each original door also appears completely within at least one tile. Inspect edge-related errors during validation before choosing later tiling changes.

One byte-identical ASC page was removed: `11a509fe-project_001_page_005.png`. Kept `7b2f6446-project_001_page_005.png` and its 18 annotations. The duplicate page had separately drawn boxes around the same doors; these were not merged. This reduces the original 526 labels to 508 labels on unique pages.

Image paths were repaired and bounding boxes were checked against image dimensions. Preparation preserves the supplied annotations; it does not certify that every real door is labeled or that every supplied label is correct. Representative crops were visually checked.

## Contents

- `data/train`, `data/valid`, `data/test`: tile images and `_annotations.coco.json` for RF-DETR.
- `data/full_pages`: cleaned original pages and COCO labels, retained for later full-page evaluation.
- `data/preparation_report.json`: source provenance, removed duplicate, counts, tiling settings.
- `prepare_dataset.py`: reproducible preparation script; requires Pillow and the five original Label Studio ZIPs.
- `train_doors.py`: initial Mac training command.

The class is `door`, category ID 0. RF-DETR's custom COCO loader maps categories to model indices. Source provenance fields in COCO are extra metadata.

Tile validation scores measure performance on tiles, not full-page door counts. Deployment should use overlapping crops at the same scale, translate predictions to page coordinates, and merge duplicate detections. Evaluate that full-page pipeline against the preserved original-page labels before reporting counting accuracy.

To rebuild in a separate location:

```bash
python doors_commercial_v1/prepare_dataset.py --exports /path/to/five_exports --output /path/to/new_dataset
```

The exports directory must contain exactly one `project-N-at-*.zip` for each N from 1 through 5, with the same project mapping as above. Never rebuild over the included prepared data.

## Reference

RF-DETR configuration: https://rfdetr.roboflow.com/latest/reference/train_config/
