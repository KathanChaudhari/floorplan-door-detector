import { useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Icon } from '../../../components/ui/Icon.tsx'
import { useDoorReview } from '../hooks/useDoorReview.ts'
import { DetectionToolbar } from './DetectionToolbar.tsx'
import { ExportActions } from './ExportActions.tsx'
import { PlanViewer } from './PlanViewer.tsx'
import { ReviewSummary } from './ReviewSummary.tsx'
import { SheetSidebar } from './SheetSidebar.tsx'

export function Workspace() {
  const r = useDoorReview()
  const [zoom, setZoom] = useState(100)
  const page = r.editor.page
  const status = r.phase ?? (r.job?.status === 'running' || r.job?.status === 'queued' ? r.job.message : r.editor.dirty ? 'Unsaved changes' : r.job ? 'Saved on this Mac' : r.connecting ? 'Connecting to backend…' : 'Ready to open a PDF')
  return <div className="app-shell">
    <header className="app-header">
      <div className="brand"><span className="brand-mark"><Icon name="door" size={25} /></span><div><strong>Door Review</strong><small>DRAWING WORKSPACE</small></div></div>
      <div className="document-heading"><Icon name="file" size={18} /><span title={r.job?.name}>{r.job?.name ?? 'No document open'}</span></div>
      <div className={`header-status ${r.editor.dirty ? 'is-unsaved' : ''}`} role="status">{r.busy ? <span className="spinner" /> : <span className="connection-dot" />}{status}</div>
      <span className="local-badge">Local{r.config ? ` · ${r.config.device.toUpperCase()}` : ''}</span>
    </header>
    <SheetSidebar review={r} />
    <main className="workspace">
      <ReviewSummary review={r} />
      {r.error && <div className="error-banner" role="alert"><div><strong>Action needs attention</strong><p>{r.error}</p></div><div className="error-actions">
        {!r.config && <Button disabled={r.connecting} onClick={r.reconnect}>Retry connection</Button>}
        {r.editor.dirty && <><Button disabled={r.busy} onClick={() => void r.save()}>Try saving again</Button><Button disabled={r.busy} onClick={() => void r.reload()}>Discard & reload</Button></>}
        <Button variant="ghost" className="icon-button" aria-label="Dismiss error" onClick={r.dismissError}><Icon name="close" size={16} /></Button>
      </div></div>}
      {r.uploadProgress !== null && <div className="upload-progress" role="status"><span>{r.uploadProgress === 100 ? 'Reading PDF sheets…' : `Uploading PDF · ${r.uploadProgress}%`}</span><progress max={100} value={r.uploadProgress} /></div>}
      {r.job?.status === 'error' || r.job?.status === 'interrupted' ? <div className="job-notice" role="status">{r.job.message} Completed results are retained. Select pending sheets and retry detection.</div> : null}
      {r.config && !r.config.available.v3 && <div className="job-notice">V3 checkpoint is unavailable. Check the backend model configuration before detection.</div>}
      {r.blockedV3 && <div className="job-notice">A selected undetected sheet already has edits. Keep those corrections, or open a new document to run V3 on that sheet.</div>}
      <DetectionToolbar review={r} zoom={zoom} setZoom={setZoom} />
      <div className="sheet-toolbar">
        <div className="sheet-heading"><strong>{page ? `Sheet ${page.number}` : 'Plan viewer'}</strong>{page && <span className={`sheet-state ${page.reviewed ? 'is-reviewed' : ''}`}>{page.reviewed ? <Icon name="check" size={12} /> : <span className="state-dot" />}{page.reviewed ? 'Reviewed' : 'Draft'}<span className="state-divider">·</span>{page.boxes.length} openings</span>}</div>
        <div className="review-actions">
          <label className="reference-toggle"><input type="checkbox" checked={r.showReference} disabled={!page?.reference} onChange={(event) => r.setShowReference(event.target.checked)} /><span>Show V4{page?.reference ? ` · ${page.reference.boxes.length}` : ''}</span></label>
          <Button disabled={r.busy || !r.editor.dirty} onClick={() => void r.save()}><Icon name="save" size={15} /> Save changes</Button>
          <Button variant={page?.reviewed ? 'default' : 'primary'} disabled={r.busy || !r.imageReady} onClick={() => void r.review()}><Icon name="check" size={15} />{page?.reviewed ? 'Reopen review' : 'Confirm reviewed'}</Button>
        </div>
      </div>
      <PlanViewer key={`${r.job?.id ?? 'empty'}:${page?.number ?? 0}:${r.viewVersion}`} review={r} zoom={zoom} />
      <div className="viewer-legend"><div><span className="legend-box" /> Editable openings <span className="legend-box legend-box--reference" /> V4 reference only</div><span>{r.editor.selected.length ? `${r.editor.selected.length} selected · ` : ''}Shift / ⌘ select multiple · Delete remove · ⌘ / Ctrl Z undo</span></div>
      <ExportActions review={r} />
      <div className="counting-note">One complete opening per box. Double-door leaves count together as one. Repeated drawings are not deduplicated across sheets.</div>
    </main>
  </div>
}
