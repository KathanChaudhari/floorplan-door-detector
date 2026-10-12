# Floor-plan door detection

This repository contains a local YOLO-based door detector and small scripts for inspecting floor-plan PDFs and geometry. It is a Python project; the Next.js app described in the workspace notes is not present here.

## Run the detector

Install the packages in `requirements.txt`, then run from the repository root:

```bash
python detect.py
```

The script reads `data/sample1.jpg` with `models/architect/best.pt`, prints detections, and writes an annotated image to `outputs/architect-detected.jpg`. It reports a clear file-not-found error if either input is missing.

## Inspection scripts

- `inspect_pdf.py` reports page counts and basic PDF content. It expects `data/source.pdf`.
- `inspect_geometry.py` marks curve candidates on page 2 and writes a preview under `outputs/`.
- `inspect_line_segments.py` and `find_arc_candidates.py` create additional geometry previews. Check their constants near the top of each file to see the expected input and output paths.

The separate RF-DETR training package and dataset notes are in [`rf_detr/doors_commercial_v1/README.md`](rf_detr/doors_commercial_v1/README.md).

## Local files

Datasets, model weights, and generated outputs are local working files and are excluded from version control. The detector expects its sample image and model at the paths listed above.
