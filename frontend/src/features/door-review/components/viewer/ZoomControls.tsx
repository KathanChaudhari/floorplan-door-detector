import { Button } from '../../../../components/ui/Button.tsx'
import { Icon } from '../../../../components/ui/Icon.tsx'
import { clampZoom, MAX_ZOOM, MIN_ZOOM } from './viewport.ts'

type Props = {
  ready: boolean
  zoom: number
  onZoomChange: (value: number) => void
  onFit?: () => void
  fullView?: boolean
  onToggleFullView?: () => Promise<void>
}

export function ZoomControls({ ready, zoom, onZoomChange, onFit, fullView = false, onToggleFullView }: Props) {
  return <div className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur-sm"
    role="group" aria-label="Sheet view controls" title="Ctrl/⌘ + scroll or pinch to zoom · scroll to pan">
    <Button size="tool" variant="ghost" disabled={!ready} onClick={onFit ?? (() => onZoomChange(100))} title="Fit whole sheet" aria-label="Fit whole sheet"><Icon name="fit" size={16} /></Button>
    <Button size="tool" variant="ghost" disabled={!ready || zoom <= MIN_ZOOM} onClick={() => onZoomChange(clampZoom(zoom - 25))} title="Zoom out" aria-label="Zoom out"><Icon name="minus" size={15} /></Button>
    <output className="min-w-11 text-center text-[11px] text-muted tabular-nums" aria-label="Zoom relative to fit">{Math.round(zoom)}%</output>
    <Button size="tool" variant="ghost" disabled={!ready || zoom >= MAX_ZOOM} onClick={() => onZoomChange(clampZoom(zoom + 25))} title="Zoom in" aria-label="Zoom in"><Icon name="add" size={15} /></Button>
    <span className="mx-1 h-4 w-px bg-border" />
    <Button size="tool" variant="ghost" disabled={!ready || !onToggleFullView} onClick={() => void onToggleFullView?.()} title={fullView ? 'Exit full view (Esc)' : 'Full view'} aria-label={fullView ? 'Exit full view' : 'Full view'} aria-pressed={fullView}>
      <Icon name={fullView ? 'restore' : 'fullscreen'} size={16} />
    </Button>
  </div>
}
