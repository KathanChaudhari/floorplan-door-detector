# Door detector v2: reviewed commercial plans

Extract this folder into your Mac project:

`/Users/kathan/Projects/floorplan-door-detector/rf_detr`

The folder should sit beside `doors_commercial_v1`, not inside it. This kit
reuses the original PNGs already in `doors_commercial_v1/data/full_pages`.
It does not contain model weights or a prebuilt image dataset.

## 1. Activate your existing environment

```bash
cd /Users/kathan/Projects/floorplan-door-detector/rf_detr
source .venv/bin/activate
```

Keep the RF-DETR environment that successfully trained v1. No upgrade is
needed. Dataset preparation requires Pillow, already used by the earlier scripts.

## 2. Build the updated dataset

```bash
python doors_commercial_v2_kit/prepare_v2.py
```

This verifies all 14 original page images against their audited SHA-256
hashes and builds `doors_commercial_v2_kit/data`. It stops if that output
already exists; choose a fresh `--output` path for a deliberate rebuild.
Preparation can take several minutes and uses additional disk space.

The revised training annotations are mapped back onto the original ten
training pages. Review crops are not appended as an extra copy of the same
data. Grid crops and door-centred crops expand where needed so every labelled
door intersecting a training crop is complete. Exact duplicate crop rectangles
are removed. Some crops are larger than 768 pixels; the model resizes them
during training. Variable crop sizes are an intentional tradeoff to avoid
learning tiny clipped fragments as whole doors.

The four reviewed empty crops outside the unresolved elevator area are always
included. Other background crops with drawn content are sampled at about one
per three positive crops. Two unresolved regions are excluded from all training
crops, including overlapping crops, rather than treated as empty background.

Norco validation and UC Davis test page images and labels are unchanged.
Their 768-pixel grid, stride and clipping convention are retained so the
evaluation data remains comparable to v1. The regenerated tile filenames differ.

## 3. Train five more epochs from the best v1 weights

```bash
python doors_commercial_v2_kit/train_v2.py
```

Defaults:

- Input weights: `outputs/doors_commercial_v1/checkpoint_best_ema.pth`
- Model: RF-DETR Small, one class `door`, resolution 512.
- Device: MPS, batch size 1, accumulation 4, workers 0.
- Learning rates: `lr=5e-5`, `lr_encoder=5e-5`.
- Training length: 5 epochs, EMA/checkpoint behavior from your installed RF-DETR.
- Output: `outputs/doors_commercial_v2`.
- Automatic test evaluation: disabled.

This is a new fine-tuning run initialized with v1 model weights. It does not
restore the old optimizer or old epoch counter. The output folder must be
empty or new, so it cannot overwrite your v1 weights.

Do not assume that five epochs will improve the detector. Compare the best
checkpoint on the same Norco pages and inspect actual door recognition,
duplicates and box geometry separately.

## 4. Compare on Norco

Use the prediction script already on your Mac:

```bash
python predict_norco_v2.py --checkpoint outputs/doors_commercial_v2/checkpoint_best_ema.pth
```

Its default validation-page path still points at v1 Norco pages; those page
images and labels are the same in v2. Keep the previous confidence, NMS and
matching thresholds for the comparison. Inspect `comparison.json` and the two
new `*_v2_review.png` files in the timestamped output directory, and share them
along with the training log.

The script's baseline/v2 comparison describes its two prediction-merging
methods within a single checkpoint run. To compare model training v1 versus
v2, compare the v2-method results from the previous checkpoint run with the
v2-method results from this new checkpoint run.

Leave UC Davis test pages untouched until model decisions are finished.

## Annotation audit

The export contains 72 images, 385 boxes and six images without boxes. All PNG
pixels match the original review batch. The six empty-image records have null
width/height metadata; actual dimensions were verified from the images. The
rebuilt dataset uses original page dimensions rather than those null values.

The 385 boxes describe 202 distinct source-page door groups after resolving
overlapping crops. Representative boxes replace 199 existing source boxes;
three groups add labels missing from v1. Two slimmer sliding-door boxes were
explicitly associated with their original labels, avoiding duplicate doors.

Four original door annotations omitted from the review were preserved:

| Door tag | Page | Review crops where it was omitted |
| --- | --- | --- |
| 1133 | ASC 003 | 014, 034, 059 |
| 72 | GVHC Stockton 000 | 046 |
| 26 | GVHC Stockton 003 | 020, 071, 072 |
| A170 | Greenville 000 | 016 |

Two areas remain unresolved and are excluded from training:

- The angled symbol below elevator P10, visible in 031 and 041.
- The untagged angled symbol near reception in ASC 001, visible in 032 and 051.

The latter remains in the full-page audit annotations as original ID 39, but
no training crop may intersect its exclusion region. Full-page training audit
annotations therefore contain 319 entries; 318 are eligible for training.

`annotation_review.jpg` shows the four preserved doors and two excluded areas.
Red rectangles mark the relevant original annotation or symbol location.
`annotation_audit.json` records the changes. `local_preparation_report.json`
records the end-to-end rebuild performed while preparing this kit.

The dataset preparation was run and checked here. Model training and inference
must run on your Mac, where your 122 MB checkpoint and working MPS environment
are available. No trained v2 checkpoint is included.

RF-DETR training reference: https://rfdetr.roboflow.com/learn/train/
