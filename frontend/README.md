# Door Review frontend

One dashboard built with React, TypeScript, Vite and Tailwind CSS. There is no
router, session context/provider or shared layout layer.

## Run

Start the existing API in another terminal:

```bash
cd /Users/kathan/Projects/floorplan-door-detector/rf_detr
DOOR_MVP_DEV_ORIGINS='http://127.0.0.1:5173,http://localhost:5173' .venv/bin/python -B door_mvp/app.py
```

Start the frontend:

```bash
cd /Users/kathan/Projects/floorplan-door-detector/frontend
npm run dev
```

Vite serves http://127.0.0.1:5173 and proxies `/api` to
http://127.0.0.1:8765. The backend does not serve the frontend build. Use `npm ci`
when installing dependencies on a fresh checkout.

## Dashboard

- The header's sidebar icon opens/closes the file drawer. The dashboard, file
  drawer and tools are visible on the first load; upload/reopen a PDF or PNG,
  JPEG or WebP image inside the drawer. A successful upload opens its sheets
  there. An image is one sheet at its original resolution. Files may be up to
  250 MB; images must be single-frame and at most 40 million pixels.
- Drag anywhere along the drawer's right border to resize it. Resizing preserves
  a usable minimum width; opening/closing belongs to the header toggle. The
  border supports Left/Right arrow keys, and Escape closes the drawer. On narrow
  screens the drawer overlays the canvas.
- All sheets start selected on upload. Uncheck any sheets to exclude them from
  detection/export. Saved selections are preserved when reopening a file.
  Per-sheet opening counts appear only after V3 detection completes.
  The selected file name is shown in the file selector and main toolbar.
- V3 model and V4 reference buttons include their names and icons. The other
  editing tools remain small icons with hover titles. Toggle V4 in the drawer.
- Click an existing opening to select it, then drag it or its corner handles to
  move/resize. Drag empty sheet space to create an opening without switching
  tools. Shift/Cmd-click selects multiple. The select/draw icons remain available
  as shortcuts. Delete, merge and undo retain their existing behavior.
- Edits save automatically after a 600 ms pause. Drawing/resizing and pending
  operations pause autosave; failed saves retain the draft and offer a retry.
  Use **Confirm review** in the main toolbar. Every edit/undo clears reviewed
  status; automatic saving does not confirm a review.
- Choose marked PDF, CSV or JSON at the top and use the download icon. Export is
  enabled only after every selected sheet is saved and reviewed. Reviewed zero
  openings is valid. V4 reference boxes do not enter reviewed counts or exports.

The floating bottom bar contains fit, minus/plus, zoom percentage and full view.
Ctrl/Command + mouse wheel and trackpad pinch zoom around the pointer. Ordinary
scrolling pans. Two-finger touch gestures zoom/pan while cancelling any unfinished
box drawing. The fit button resets the sheet to the available canvas size. Full
view expands the canvas using native fullscreen where supported, with a viewport
layout fallback; Escape or the same button exits.

The viewer supports Delete/Backspace, Cmd/Ctrl Z, Cmd/Ctrl S and Escape when focused.
Pointer coordinates use the inverse SVG screen transform. Zooming, panning and
thinner visual box outlines do not change saved opening coordinates.

Sheet/file switches and new uploads save the current draft first. Save failures
retain the draft and its revision and block switching. The browser warns before
closing/refreshing while edits or operations are pending. Failed actions appear
as compact inline feedback; discarding a draft still requires confirmation.
Detection runs on the existing backend and uses one cancellable polling loop.
Closing or resizing the drawer does not reset the editor or stop polling.

## Source

```text
src/
  app/App.tsx
  pages/dashboard/
    DashboardPage.tsx
    SheetDrawer.tsx
    drawer.ts
  features/
    projects/
      api.ts, types.ts, upload.ts
      hooks/useProjects.ts
      components/UploadPanel.tsx
    sheets/
      api.ts, types.ts
    door-review/
      api.ts, types.ts, editor.ts, autosave.ts, pollDetection.ts
      hooks/useDoorReview.ts
      components/review/
        DetectionControls.tsx, DetectionToolbar.tsx, ExportActions.tsx
      components/viewer/
        PlanViewer.tsx, BoxOverlay.tsx, ZoomControls.tsx
        useViewerGestures.ts, useFullView.ts, viewport.ts
  components/ui/
    Button.tsx, buttonStyles.ts, Icon.tsx, Spinner.tsx
  lib/http.ts
  styles/tailwind.css
  main.tsx
tests/
  dashboard.test.ts, drawer.test.ts, editor.test.ts, autosave.test.ts
  viewer.test.ts, polling.test.ts, workflow.test.ts, upload.test.ts
  fixtures.ts
```

`App` renders `DashboardPage` directly. The dashboard owns one `useDoorReview`
controller, its zoom state and drawer visibility. `SheetDrawer` is a component
colocated with that page and owns its drag/width state. API functions, editor
operations, HTTP handling and reusable controls remain separate small modules.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Tests use the built-in Node test runner with TypeScript stripping. They cover
editor geometry/revisions, review/export rules, V4 isolation, polling cleanup,
drawer resizing, autosave timing/cancellation, wheel/pinch zoom math, pointer anchoring, automatic editing
behavior and the API/reducer workflow using mocked HTTP. The first-render test
uses the installed Vite compiler and React server rendering, with HTTP/WebSocket
listening disabled, to check the initial dashboard and toolbar placement.
They do not open a browser, upload a real file or run inference. Live pointer/touch
interactions, native fullscreen and real upload/detection/download remain manual
checks. Backend API tests cover actual PDF/image uploads, rendering and exports
using generated fixtures without running inference.
