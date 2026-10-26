import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { api } from '../api.ts'
import type { DoorReview } from '../hooks/useDoorReview.ts'
import { BoxOverlay } from './BoxOverlay.tsx'
import { UploadPanel } from './UploadPanel.tsx'

export function PlanViewer({ review: r, zoom }: { review: DoorReview; zoom: number }) {
  const viewport = useRef<HTMLDivElement>(null)
  const [space, setSpace] = useState({ width: 900, height: 650 })
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const page = r.editor.page
  useEffect(() => {
    if (!viewport.current) return
    const observer = new ResizeObserver(([entry]) => setSpace({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])

  const width = page?.width ?? (page?.point_size[0] ?? 1) * (r.job?.dpi ?? 150) / 72
  const height = page?.height ?? (page?.point_size[1] ?? 1) * (r.job?.dpi ?? 150) / 72
  const fit = Math.max(.01, Math.min(Math.max(100, space.width - 64) / width, Math.max(100, space.height - 64) / height))
  const scale = fit * zoom / 100

  return <div ref={viewport} className="plan-viewport" tabIndex={0} aria-label="Floor-plan viewer"
    onKeyDown={(event) => {
      if (r.busy || !r.imageReady || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); r.undo() }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void r.save() }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); r.remove() }
      else if (event.key === 'Escape') r.select([])
    }}>
    {!r.job || !page ? <UploadPanel disabled={r.busy || !r.config} upload={r.upload} /> : <>
      {loading && !failure && <div className="viewer-message" role="status"><span className="spinner" /> Rendering sheet {page.number}…</div>}
      {failure && <div className="viewer-message viewer-message--error" role="alert"><strong>Could not render this sheet</strong><p>Check the backend connection. Sheets over 40 million pixels at 150 DPI must be cropped before upload.</p><Button onClick={() => { setFailure(false); setLoading(true); setAttempt((n) => n + 1) }}>Retry rendering</Button></div>}
      {!failure && <div className="plan-canvas" style={{ width: Math.max(space.width, width * scale + 64), minHeight: Math.max(space.height, height * scale + 64) }}>
        <div className="plan-sheet" style={{ width: width * scale, height: height * scale, visibility: loading ? 'hidden' : 'visible' }}>
          <img src={`${api.image(r.job.id, page.number)}?attempt=${attempt}`} alt={`Floor plan — sheet ${page.number}`} draggable={false}
            onLoad={(event) => { setLoading(false); r.ready({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }) }}
            onError={() => { setLoading(false); setFailure(true) }} />
          {!loading && r.imageReady && <BoxOverlay size={{ width, height }} boxes={page.boxes} reference={r.showReference ? page.reference?.boxes ?? [] : []}
            selected={r.editor.selected} mode={r.editor.mode} disabled={r.busy} scale={scale} onSelect={r.select} onChange={r.change} focusViewer={() => viewport.current?.focus({ preventScroll: true })} />}
        </div>
      </div>}
    </>}
  </div>
}
