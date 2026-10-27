# Door Review frontend

A desktop drawing workspace built with the existing React 19 + TypeScript + Vite
scaffold and its installed dependency versions. No router, global-state library,
CSS framework, or new runtime/test dependency was added.

## Run

Start the API in another terminal:

```bash
cd /Users/kathan/Projects/floorplan-door-detector/rf_detr
DOOR_MVP_DEV_ORIGINS='http://127.0.0.1:5173,http://localhost:5173' .venv/bin/python -B door_mvp/app.py
```

Start React:

```bash
cd /Users/kathan/Projects/floorplan-door-detector/frontend
npm run dev
```

Open http://127.0.0.1:5173. Vite binds that exact address/port and fails if the port
is already in use. All browser API URLs are relative `/api` URLs, proxied to
http://127.0.0.1:8765. Explicit backend development origins are necessary because
the browser Origin header is preserved through the proxy. API docs stay available
at http://127.0.0.1:8765/docs. The backend does not serve this app or its build.
`npm ci` is only needed when installing this frontend on a fresh checkout.

## Review workflow

1. Upload an unlocked PDF up to 250 MB, or reopen a saved document. Actual upload
   progress is shown; parsing/rendering and detection have distinct busy feedback.
2. Open sheets to inspect them. Check only the enlarged floor-plan sheets to
   process/export. Uploading or opening a sheet never selects it automatically.
3. Run **Detect V3**. The frontend polls the existing background job until it is
   ready or reports an error. Processed/corrected sheets are not overwritten.
4. Select boxes and drag to move; use corner handles to resize. Shift/Cmd-click
   selects multiple. Add opening draws a new box; Delete removes; Merge takes the
   union of selected boxes; Undo reverses edits. Merge only leaves/duplicates of
   the same doorway. Double doors count as one complete opening.
5. Save changes, then **Confirm reviewed** after checking the whole selected sheet.
   Any edit or undo clears review. A reviewed zero-opening sheet is valid.
6. Export JSON, CSV or marked PDF once every selected sheet is saved and reviewed.
   The summary counts only selected reviewed sheets. Purple V4 reference boxes
   never enter the editable state, reviewed count, or exports.

V4 reference detection is optional. Its dashed overlay can be shown/hidden. Zoom is
relative to fit; fit adjusts to the available viewport, with scrolling when zoomed.
Pointer coordinates use the inverse SVG screen transform and the rendered page's
actual dimensions. Zoom, scroll and viewport resizing do not alter stored pixels.

The viewer supports Delete/Backspace, Cmd/Ctrl Z, Cmd/Ctrl S and Escape when focused.
Opening boxes can also be selected with Enter/Space when keyboard-focused.

## Saving and failure states

Page/session switches and new uploads first save existing edits. A failed save
blocks navigation and retains the draft and original revision. Conflict responses
are displayed; revisions are never silently advanced. Use **Discard & reload**
only after its explicit confirmation if you want to abandon a draft. Failed reloads
still retain local edits. Browser navigation warns about unsaved changes.

Controls that conflict with saves/detection are disabled. Polling retries connection
failures, aborts on cleanup, and ignores late replies. Reopening a saved running job
resumes polling. Completed backend results remain on disk if the browser closes.

## Source

```text
src/app/App.tsx
src/features/door-review/
  api.ts, types.ts, editor.ts
  hooks/useDoorReview.ts
  components/ (workspace, documents/sheets, tools, SVG editor, summary, exports)
src/components/ui/ (Button, Icon)
src/styles/workspace.css
tests/editor.test.ts
```

`Workspace` owns the review hook and composes the header, notices, sheet toolbar,
viewer and export footer. The header, notices, sheet toolbar, summary and export
components receive typed data and callbacks, keeping their presentation separate
from the review hook's API and editing state.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Tests use the built-in Node test runner with TypeScript stripping (the installed
Node 24 supports it). They exercise coordinate transforms under zoom/scroll,
boundary clamping, metadata/ID preservation, merging, edit/undo review transitions,
late-response protection and V4/count isolation. These are fixture-based unit
checks, not simulated successful model runs. Backend contract tests live in
`../tests/test_api.py` and use synthetic PDFs in isolated temporary stores.

The production build goes to `dist/` and is ignored by Git. `npm run preview` can
inspect build output but is not the documented API-proxied development workflow.
The app remains a local single-user assisted-review MVP; sheets/door identities and
repeated drawings still require human review.
