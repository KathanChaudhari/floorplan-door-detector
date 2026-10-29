import { useState } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Icon } from '../../components/ui/Icon.tsx'
import { Spinner } from '../../components/ui/Spinner.tsx'
import { DetectionToolbar } from '../../features/door-review/components/review/DetectionToolbar.tsx'
import { ExportActions } from '../../features/door-review/components/review/ExportActions.tsx'
import { PlanViewer } from '../../features/door-review/components/viewer/PlanViewer.tsx'
import { ZoomControls } from '../../features/door-review/components/viewer/ZoomControls.tsx'
import { useDoorReview } from '../../features/door-review/hooks/useDoorReview.ts'
import { isDetecting } from '../../features/door-review/pollDetection.ts'
import { SheetDrawer } from './SheetDrawer.tsx'

export function DashboardPage() {
  const review = useDoorReview()
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [zoom, setZoom] = useState(100)
  const { job, editor, summary } = review
  const page = editor.page
  const activity = review.phase ?? (review.connecting ? 'Connecting…' : isDetecting(job) ? job?.message : null)
  const error = review.error ?? (job?.status === 'error' || job?.status === 'interrupted' ? job.message : null)

  async function upload(file: File) {
    if (await review.upload(file)) {
      setDrawerOpen(true)
      setZoom(100)
    }
  }

  async function openDocument(id: string) {
    if (await review.openDocument(id)) {
      setDrawerOpen(true)
      setZoom(100)
    }
  }

  return <div className="flex h-dvh min-h-[480px] flex-col bg-white">
    <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
      <Button id="drawer-toggle" variant="ghost" size="icon" aria-label="Toggle sheet drawer" aria-expanded={drawerOpen} aria-controls="sheet-drawer"
        onClick={() => setDrawerOpen((open) => !open)} title="Files and sheets"><Icon name="sidebar" size={20} /></Button>
    </header>
    <div className="relative flex min-h-0 flex-1">
      <SheetDrawer open={drawerOpen} onOpenChange={setDrawerOpen} documents={review.sessions}
        documentId={job?.id} documentName={job?.name} pages={summary.pages} selectedPages={job?.selected_pages ?? []}
        page={page} summary={summary} dirty={editor.dirty} busy={review.busy}
        uploadDisabled={review.busy || !review.config} showReference={review.showReference}
        onUpload={upload} onOpenDocument={openDocument} onOpenPage={review.openPage} onSelectPage={review.selectPage}
        onShowReferenceChange={review.setShowReference} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          {!job && <span className="text-[12px] font-medium text-muted">Drawing workspace</span>}
          {job && <span className="min-w-0 truncate text-[11px] text-muted" title={job.name}>{job.name}{page ? ` · Sheet ${page.number}` : ''}</span>}
          {activity && <span className="flex min-w-0 items-center gap-2 text-[10px] text-muted" role="status"><Spinner /><span className="truncate" title={activity}>{activity}</span></span>}
          {review.uploadProgress !== null && <progress className="h-1 w-16 shrink-0 accent-accent" max={100} value={review.uploadProgress} aria-label="PDF upload progress" />}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button size="icon" disabled={review.busy || !editor.dirty} onClick={() => void review.save()} aria-label="Save changes" title="Save changes"><Icon name="save" size={16} /></Button>
            <ExportActions canExport={summary.canExport} busy={review.busy} onExport={review.exportReview} />
          </div>
        </div>
        {error && <div className="flex flex-wrap items-center gap-2 border-b border-[#edd7cf] bg-[#fff3ee] px-3 py-2 text-[11px] text-[#94523e]" role="alert">
          <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">{error}</p>
          {!review.config && <Button disabled={review.connecting} onClick={review.reconnect}>Retry connection</Button>}
          {editor.dirty && <Button disabled={review.busy} onClick={() => void review.reload()}>Discard & reload</Button>}
          {review.error && <Button variant="ghost" size="icon" aria-label="Dismiss error" onClick={review.dismissError}><Icon name="close" size={14} /></Button>}
        </div>}
        <DetectionToolbar busy={review.busy} imageReady={review.imageReady} canDetectV3={review.canDetectV3}
          canDetectV4={review.canDetectV4} blockedV3={review.blockedV3} onDetect={review.detect}
          mode={editor.mode} selectedCount={editor.selected.length} canUndo={editor.history.length > 0}
          onModeChange={review.mode} reviewed={page?.reviewed ?? false} onReview={review.review}
          onMerge={review.merge} onRemove={review.remove} onUndo={review.undo} />
        {job && page ? <PlanViewer key={`${job.id}:${page.number}:${review.viewVersion}`} jobId={job.id} dpi={job.dpi} page={page}
            busy={review.busy} imageReady={review.imageReady} zoom={zoom} onZoomChange={setZoom} showReference={review.showReference} onReady={review.ready}
            editing={{ mode: editor.mode, selected: editor.selected, onSelect: review.select, onChange: review.change,
              onUndo: review.undo, onSave: review.save, onRemove: review.remove }} />
          : <div className="relative grid min-h-0 flex-1 place-items-center bg-[#eaf0ed] bg-[radial-gradient(#b4c6b742_.7px,transparent_.7px)] bg-size-[12px_12px]">
          <p className="px-6 text-center text-[12px] text-muted">Choose a PDF from Files to open a sheet.</p>
          <ZoomControls ready={false} zoom={zoom} onZoomChange={setZoom} />
        </div>}
      </main>
    </div>
  </div>
}
