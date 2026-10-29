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

- The header contains only the app icon.
- Upload a PDF in the canvas or drawer. A successful upload opens its sheet drawer.
  Previously saved files can be reopened from the drawer's file selector.
- Click the drawer edge or toolbar toggle to open/close it. Drag the edge to resize;
  dragging almost fully left closes it. Drag right from the closed edge to reopen.
  The handle also supports Enter/Space and Left/Right arrow keys. Escape closes
  the drawer while focus is inside it. On narrow screens it overlays the canvas.
- Check sheets to include them in detection and export. Opening a sheet does not
  select it. Compact text in the drawer shows selected sheets, reviewed sheets and
  reviewed opening counts.
- Run **Detect V3**, then correct boxes in the viewer. Selection, movement, corner
  resizing, adding, deleting, merging and undo retain the existing behavior. V4 is
  an optional separate reference overlay, toggled in the drawer.
- Save edits with the top save icon or Cmd/Ctrl S. Confirm the active sheet using
  **Confirm reviewed** in the drawer. Every edit/undo clears reviewed status.
- Choose marked PDF, CSV or JSON at the top and use the download icon. Export is
  enabled only after every selected sheet is saved and reviewed. Reviewed zero
  openings is valid. V4 reference boxes do not enter reviewed counts or exports.

The canvas supports fit/zoom and scrolling. Delete/Backspace, Cmd/Ctrl Z,
Cmd/Ctrl S and Escape work when the viewer is focused. Box coordinates use the
inverse SVG screen transform, so zoom/scroll do not alter stored coordinates.

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
      api.ts, types.ts
      hooks/useProjects.ts
      components/UploadPanel.tsx
    sheets/
      api.ts, types.ts
    door-review/
      api.ts, types.ts, editor.ts, pollDetection.ts
      hooks/useDoorReview.ts
      components/review/
        DetectionControls.tsx, DetectionToolbar.tsx, ExportActions.tsx
      components/viewer/
        PlanViewer.tsx, BoxOverlay.tsx, ZoomControls.tsx
  components/ui/
    Button.tsx, buttonStyles.ts, Icon.tsx, Spinner.tsx
  lib/http.ts
  styles/tailwind.css
  main.tsx
tests/
  drawer.test.ts, editor.test.ts, polling.test.ts, workflow.test.ts
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
drawer sizing/snap behavior and the API/reducer workflow using mocked HTTP.
They do not open a browser, upload a real PDF or run inference. Live pointer/touch
interactions and the real upload/detection/download flow remain manual checks.
The backend, saved files and model configuration are unchanged.
