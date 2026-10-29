import { Button } from '../../../../components/ui/Button.tsx'
import { Icon } from '../../../../components/ui/Icon.tsx'

type Props = { ready: boolean; zoom: number; onZoomChange: (value: number) => void }

export function ZoomControls({ ready, zoom, onZoomChange }: Props) {
  return <div className="ml-auto flex items-center gap-px max-[650px]:ml-0 max-[650px]:gap-[3px] [&_button]:border-transparent" aria-label="Zoom controls">
    <Button size="icon" disabled={!ready} onClick={() => onZoomChange(100)} title="Fit sheet" aria-label="Fit sheet"><Icon name="fit" size={16} /></Button>
    <Button size="icon" disabled={!ready || zoom <= 50} onClick={() => onZoomChange(Math.max(50, zoom - 25))} title="Zoom out" aria-label="Zoom out"><Icon name="minus" size={14} /></Button>
    <output className="min-w-10 text-center text-[10px] text-[#6e8174] tabular-nums" aria-label="Zoom relative to fit">{zoom}%</output>
    <Button size="icon" disabled={!ready || zoom >= 600} onClick={() => onZoomChange(Math.min(600, zoom + 25))} title="Zoom in" aria-label="Zoom in"><Icon name="add" size={14} /></Button>
  </div>
}
