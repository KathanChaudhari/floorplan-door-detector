import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../../components/ui/Button.tsx'
import { Spinner } from '../../../../components/ui/Spinner.tsx'
import { sheetsApi } from '../../../sheets/api.ts'
import type { Sheet } from '../../../sheets/types.ts'
import type { Dimensions, EditMode, OpeningBox } from '../../types.ts'
import { BoxOverlay } from './BoxOverlay.tsx'
import type { BoxOverlayHandle } from './BoxOverlay.tsx'
import { ZoomControls } from './ZoomControls.tsx'
import { useFullView } from './useFullView.ts'
import { useViewerGestures } from './useViewerGestures.ts'

type ViewerEditing = {
  mode: EditMode
  selected: string[]
  onSelect: (ids: string[]) => void
  onChange: (boxes: OpeningBox[], selected?: string[]) => void
  onUndo: () => void
  onSave: () => Promise<unknown>
  onRemove: () => void
}

type Props = {
  jobId: string
  dpi: number
  page: Sheet
  busy: boolean
  imageReady: boolean
  zoom: number
  onZoomChange: (zoom: number) => void
  showReference?: boolean
  onReady: (size: Dimensions) => void
  editing?: ViewerEditing
}

export function PlanViewer({ jobId, dpi, page, busy, imageReady, zoom, onZoomChange, showReference = false, onReady, editing }: Props) {
  const frame = useRef<HTMLElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const overlay = useRef<BoxOverlayHandle>(null)
  const { fullView, toggleFullView } = useFullView(frame)
  const [space, setSpace] = useState({ width: 900, height: 650 })
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const ready = imageReady && !loading && !failure
  const gestures = useViewerGestures({ viewport, sheet, zoom, ready, onZoomChange, cancelEditing: () => overlay.current?.cancel() })
  useEffect(() => {
    if (!viewport.current) return
    const observer = new ResizeObserver(([entry]) => setSpace({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])

  const width = page.width ?? page.point_size[0] * dpi / 72
  const height = page.height ?? page.point_size[1] * dpi / 72
  const fit = Math.max(.01, Math.min(Math.max(100, space.width - 64) / width, Math.max(100, space.height - 64) / height))
  const scale = fit * zoom / 100

  return <section ref={frame} className={fullView ? 'fixed inset-0 z-50 flex flex-col bg-white' : 'relative flex min-h-0 flex-1 flex-col'} aria-label="Sheet canvas">
    <div ref={viewport} {...gestures.pointerHandlers} className="relative min-h-[200px] flex-1 touch-none overflow-auto bg-[#eaf0ed] bg-[radial-gradient(#b4c6b742_.7px,transparent_.7px)] bg-size-[12px_12px] -outline-offset-3 focus-visible:outline-3 focus-visible:outline-[#5da18e]" tabIndex={0} aria-label="Floor-plan viewer" aria-description="Click an opening to select it. Drag empty space to draw. Ctrl or Command plus scroll, or pinch, to zoom."
    onKeyDown={(event) => {
      if (!editing || busy || !imageReady || loading || failure || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); editing.onUndo() }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void editing.onSave() }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); editing.onRemove() }
      else if (event.key === 'Escape') editing.onSelect([])
    }}>
    {loading && !failure && <div className="absolute inset-0 z-1 flex items-center justify-center gap-[9px] text-[12px] text-[#758a7b]" role="status"><Spinner /> Rendering sheet {page.number}…</div>}
    {failure && <div className="absolute inset-0 z-1 flex flex-col items-center justify-center gap-[13px] p-[30px] text-center text-[12px] text-[#758a7b]" role="alert"><strong>Could not render this sheet</strong><p className="max-w-[380px] text-[12px] leading-[1.7] text-[#8c7b70]">Check the backend connection. Sheets over 40 million pixels at 150 DPI must be cropped before upload.</p><Button onClick={() => { setFailure(false); setLoading(true); setAttempt((value) => value + 1) }}>Retry rendering</Button></div>}
    {!failure && <div className="grid place-items-center p-8" style={{ width: Math.max(space.width, width * scale + 64), minHeight: Math.max(space.height, height * scale + 64) }}>
      <div ref={sheet} data-plan-sheet className={`relative shrink-0 bg-white leading-[0] shadow-[0_3px_8px_#243b2820,0_12px_38px_#243b2814] ${loading ? 'invisible' : 'visible'}`} style={{ width: width * scale, height: height * scale }}>
        <img className="block size-full select-none" src={`${sheetsApi.image(jobId, page.number)}?attempt=${attempt}`} alt={`Floor plan — sheet ${page.number}`} draggable={false}
          onLoad={(event) => { setLoading(false); onReady({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }) }}
          onError={() => { setLoading(false); setFailure(true) }} />
        {editing && !loading && imageReady && <BoxOverlay ref={overlay} size={{ width, height }} boxes={page.boxes} reference={showReference ? page.reference?.boxes ?? [] : []}
          selected={editing.selected} mode={editing.mode} disabled={busy} scale={scale} onSelect={editing.onSelect} onChange={editing.onChange} focusViewer={() => viewport.current?.focus({ preventScroll: true })} />}
      </div>
    </div>}
    </div>
    <ZoomControls ready={ready} zoom={zoom} onZoomChange={gestures.zoomAt} onFit={gestures.fitSheet} fullView={fullView} onToggleFullView={toggleFullView} />
  </section>
}
