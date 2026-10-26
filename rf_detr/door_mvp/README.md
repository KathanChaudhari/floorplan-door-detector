# Door Review — local MVP

PDF selection → V3 detection → correction → reviewed count/export.
All inference runs locally. One complete box represents one architectural opening,
including both leaves of a double door. Counts across selected sheets do not
automatically deduplicate repeated drawings, levels, or physical openings.

## Start

```bash
cd /Users/kathan/Projects/floorplan-door-detector/rf_detr
.venv/bin/python door_mvp/app.py
```

Open http://127.0.0.1:8765. Keep the terminal running; Ctrl+C stops the server.
Use one process, without reload or additional workers.
Keep the working RF-DETR 1.11.2 / Python 3.13 / PyTorch installation unchanged.
`environment-current.txt` records all installed versions; `requirements-web.txt`
lists the added web packages. `environment-before-web.txt` remains historical.

## Models and configuration

`config.json` resolves model paths relative to `rf_detr/`:

- Default V3: `door_mvp/weights/v3.pth`.
- Optional V4 reference: `door_mvp/weights/v4.pth`.

`collect_weights.py` copied the selected checkpoints and verified their SHA-256
hashes. Original checkpoint files are preserved in the external training archive.
`config.before-weights.json` preserves the original configuration for provenance;
its old paths are no longer active. No confidence, NMS, tiling, or detection rules
were changed. The app uses 768-pixel tiles, 384 stride, confidence 0.3, NMS IoU 0.5,
boundary rechecks, and model resolution 512, with 150-DPI PDF rendering.
Only one model is cached at a time. V4 reference boxes do not overwrite editable
V3 boxes, review state, revisions, or exported counts. There is no V4 fallback.

Run setup from `rf_detr/`:

```bash
.venv/bin/python -B door_mvp/check_setup.py
```

This is a path/package/device check. A successful check alone is not an inference
test. The permanent cleanup verification records include real detection with both
copied checkpoints on MPS and API workflow checks.

## Review

1. Upload an unlocked PDF smaller than 250 MB. Sheets start unchecked.
2. Open and select only the floor-plan sheets to detect and export. Exclude
   repeated overall plans, schedules, and repeated views where appropriate.
3. Choose **Detect with v3**. Initial loading can take time; progress appears in
   the UI and tile details in Terminal. Corrections are never overwritten by reruns.
4. In Select / move mode, drag boxes or resize using corner handles.
   Shift/Cmd-click selects multiple boxes. Delete removes selected boxes.
5. Add opening mode creates a box by dragging. Use one complete box per opening;
   exclude windows, cabinets, and fixtures. Merge double door takes the bounding
   union of selected boxes and must be used only for leaves of the same opening.
6. Save changes, then confirm each selected sheet reviewed. Review includes areas
   with no proposed boxes. A fully checked zero-opening sheet is valid.
7. Export only after every selected sheet is reviewed. Edits or undo reopen review.

Fit/zoom helps inspect large drawings. Switching documents/sheets saves current
edits first. Browser navigation warns about unsaved changes. Reopen saved documents
from the dropdown. The app does not automatically delete saved reviews.

## Sessions and exports

`sessions/<document-id>/` contains `source.pdf`, rendered `page_N.png` files, raw
model suggestions, and `job.json` with corrected boxes and review state. Keep the
whole folder to reopen and export a review. Existing sessions were preserved during
cleanup; cleanup tests use a separate store inside archive verification records.

- JSON contains rendered-pixel boxes, sheet dimensions/counts, source PDF hash,
  and model/checkpoint/settings provenance.
- CSV has one row per opening. The per-sheet count repeats on rows: do not sum it.
  Reviewed zero-opening sheets receive a `reviewed_zero` row.
- Marked PDF includes only selected reviewed sheets and rasterizes vectors/text.
  The uploaded original remains untouched.

The server binds to localhost and is intended for local review. Rendering is
limited to 40 million pixels per sheet. Detection jobs run sequentially. Restart
marks unfinished jobs interrupted while retaining completed results.

## Archive and storage

Training/evaluation material is preserved at
`/Users/kathan/Projects/backup floor-detection/`, using the original relative paths.
Its `_cleanup_records/` directory contains full manifests, verification evidence,
dependency records, the approved plan, original active files, and restoration notes.
Historical absolute paths remain in archived configuration as provenance. Restore
the old layout or pass explicit paths when running archived scripts. The archived
legacy environment is a restoration snapshot and may not be directly relocatable.

`storage_report.py` remains a read-only quick inventory. It excludes virtual
environments/Git/caches and sums pathname sizes without correcting hard links;
use the cleanup storage records for total project size and actual disk changes.

The internal `inference_engine.py` was preserved byte-for-byte. Its optional CLI
still has the historical default checkpoint; pass
`--checkpoint door_mvp/weights/v3.pth` when deliberately invoking that CLI from
`rf_detr/`. The app obtains its checkpoint from `config.json` instead.
