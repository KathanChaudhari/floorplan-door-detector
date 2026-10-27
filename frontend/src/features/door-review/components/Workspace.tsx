import { useState } from 'react'
import { useDoorReview } from '../hooks/useDoorReview.ts'
import { DetectionToolbar } from './DetectionToolbar.tsx'
import { ExportActions } from './ExportActions.tsx'
import { PlanViewer } from './PlanViewer.tsx'
import { ReviewSummary } from './ReviewSummary.tsx'
import { SheetSidebar } from './SheetSidebar.tsx'
import { SheetToolbar } from './SheetToolbar.tsx'
import { WorkspaceHeader } from './WorkspaceHeader.tsx'
import { WorkspaceNotices } from './WorkspaceNotices.tsx'

export function Workspace() {
  const review = useDoorReview()
  const [zoom, setZoom] = useState(100)
  const { job, editor, config, busy } = review
  const page = editor.page
  let status = 'Ready to open a PDF'
  if (review.phase !== null) status = review.phase
  else if (job?.status === 'running' || job?.status === 'queued') status = job.message
  else if (editor.dirty) status = 'Unsaved changes'
  else if (job) status = 'Saved on this Mac'
  else if (review.connecting) status = 'Connecting to backend…'

  return (
    <div className="app-shell">
      <WorkspaceHeader
        documentName={job?.name}
        device={config?.device}
        status={status}
        busy={busy}
        dirty={editor.dirty}
      />
      <SheetSidebar review={review} />
      <main className="workspace">
        <ReviewSummary summary={review.summary} />
        <WorkspaceNotices
          error={review.error}
          config={config}
          job={job}
          connecting={review.connecting}
          busy={busy}
          dirty={editor.dirty}
          uploadProgress={review.uploadProgress}
          blockedV3={review.blockedV3}
          onReconnect={review.reconnect}
          onSave={review.save}
          onReload={review.reload}
          onDismissError={review.dismissError}
        />
        <DetectionToolbar review={review} zoom={zoom} setZoom={setZoom} />
        <SheetToolbar
          page={page}
          dirty={editor.dirty}
          busy={busy}
          imageReady={review.imageReady}
          showReference={review.showReference}
          onShowReferenceChange={review.setShowReference}
          onSave={review.save}
          onReview={review.review}
        />
        <PlanViewer
          key={`${job?.id ?? 'empty'}:${page?.number ?? 0}:${review.viewVersion}`}
          review={review}
          zoom={zoom}
        />
        <div className="viewer-legend">
          <div>
            <span className="legend-box" /> Editable openings
            <span className="legend-box legend-box--reference" /> V4 reference only
          </div>
          <span>
            {editor.selected.length ? `${editor.selected.length} selected · ` : ''}
            Shift / ⌘ select multiple · Delete remove · ⌘ / Ctrl Z undo
          </span>
        </div>
        <ExportActions
          summary={review.summary}
          dirty={editor.dirty}
          busy={busy}
          onExport={review.exportReview}
        />
        <div className="counting-note">
          One complete opening per box. Double-door leaves count together as one. Repeated drawings are not deduplicated across sheets.
        </div>
      </main>
    </div>
  )
}
