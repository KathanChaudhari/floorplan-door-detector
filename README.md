# Floor-plan door review MVP

React + TypeScript + Vite frontend with an existing local FastAPI/RF-DETR backend.
Upload a PDF or PNG/JPEG/WebP image, select sheets, detect with V3, correct boxes, confirm review,
and export reviewed counts. One complete opening is one item, including both leaves
of a double door. V4 is an optional reference and never enters reviewed counts.

## Development startup — two terminals

Terminal 1 — API:

```bash
cd /Users/kathan/Projects/floorplan-door-detector/rf_detr
DOOR_MVP_DEV_ORIGINS='http://127.0.0.1:5173,http://localhost:5173' .venv/bin/python -B door_mvp/app.py
```

Terminal 2 — React:

```bash
cd /Users/kathan/Projects/floorplan-door-detector/frontend
npm run dev
```

Open **http://127.0.0.1:5173**. API documentation is at
http://127.0.0.1:8765/docs. The backend serves only the API/documentation, not the
frontend, and does not require `frontend/dist`. Use one backend worker without
reload. Stop each server with Ctrl+C. Do not start duplicate servers on these ports.

Vite uses `127.0.0.1:5173` with `strictPort: true` and proxies relative `/api`
requests to `127.0.0.1:8765`, including images, uploads and downloads. The explicit
`DOOR_MVP_DEV_ORIGINS` setting allows the browser's development Origin header;
the proxy's Host rewrite alone is insufficient. Existing same-origin checks
remain enabled and no wildcard origins are used. No direct cross-origin browser
requests or permissive CORS configuration are needed.

Frontend dependencies are already installed. For a fresh checkout, use `npm ci`
inside `frontend/` to install the versions in its lockfile. Keep the working
`rf_detr/.venv` and Python dependencies unchanged; do not install the historical
root `requirements.txt` over that environment.

## Project layout

- `frontend/src/app/`: React entry application.
- `frontend/src/features/door-review/`: typed API client, editor state, review hook
  and cohesive workspace/viewer components. Plain CSS is in `src/styles/`.
- `rf_detr/door_mvp/`: FastAPI API, unchanged inference engine, configuration and
  setup/storage/checkpoint collection scripts.
- `rf_detr/door_mvp/weights/v3.pth` and `v4.pth`: default/reference checkpoints.
- `rf_detr/door_mvp/sessions/`: saved review state, rendered pages and source PDFs/images.
  Preserve complete session folders. They are ignored by Git.
- `rf_detr/door_mvp/environment-current.txt`: working Python environment record;
  `environment-before-web.txt` and `requirements-web.txt` retain earlier records.
- `tests/test_api.py`: isolated API/origin/revision/export tests without inference.
- `frontend/tests/editor.test.ts`: coordinate, edit/review, count and V4-isolation
  unit tests using Node's built-in test runner; no new test dependencies.

See the [frontend guide](frontend/README.md) and
[backend/review guide](rf_detr/door_mvp/README.md).

## Automated checks

From the repository root:

```bash
rf_detr/.venv/bin/python -B -m unittest discover -s tests -p 'test_*.py' -v
rf_detr/.venv/bin/python -B rf_detr/door_mvp/check_setup.py
```

From `frontend/`:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

API tests use their own temporary session directories. Unit/API contract tests do
not load either model and are not a claim of inference success. The React flow
was also exercised against a separate temporary backend store with an actual local
Norco PDF and real V3/V4 MPS detection; no successful detections were mocked.

## Training archive

The archive remains `/Users/kathan/Projects/backup floor-detection/`. Its original
directory structure and `_cleanup_records/` preserve datasets, original PDFs,
annotations, licenses, training/evaluation scripts, old checkpoints, manifests,
dependency snapshots and cleanup/verification results. It was not modified by
the React migration. The archive is on the same filesystem as the project and is
not an independent off-disk backup. Preserve it.

Weights, environments, sessions, PDFs, datasets, generated outputs, node_modules
and frontend/dist are ignored. Package manifests/lockfiles, application source and
configuration remain available for version control. No commit or push is automated.
