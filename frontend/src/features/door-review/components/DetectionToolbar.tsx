import { Button } from '../../../components/ui/Button.tsx'
import { Icon } from '../../../components/ui/Icon.tsx'
import type { DoorReview } from '../hooks/useDoorReview.ts'

export function DetectionToolbar({ review: r, zoom, setZoom }: { review: DoorReview; zoom: number; setZoom: (value: number) => void }) {
  const disabled = r.busy || !r.imageReady
  return <div className="detection-toolbar" aria-label="Detection and editing tools">
    <div className="tool-group">
      <Button variant="primary" disabled={r.busy || !r.canDetectV3} onClick={() => void r.detect('v3')} title={r.blockedV3 ? 'An undetected selected sheet already has edits. Keep them, or upload a new document for detection.' : 'Detect unprocessed selected sheets with V3'}><Icon name="detect" size={16} /> Detect V3</Button>
      <Button disabled={r.busy || !r.canDetectV4} onClick={() => { r.setShowReference(true); void r.detect('v4') }} title="Run V4 on selected sheets as a separate reference"><Icon name="layers" size={16} /> V4 reference</Button>
    </div>
    <div className="tool-group editing-tools" role="group" aria-label="Box tools">
      <Button disabled={disabled} className={r.editor.mode === 'select' ? 'is-active' : ''} aria-pressed={r.editor.mode === 'select'} onClick={() => r.mode('select')}><Icon name="cursor" size={16} /> Select</Button>
      <Button disabled={disabled} className={r.editor.mode === 'add' ? 'is-active' : ''} aria-pressed={r.editor.mode === 'add'} onClick={() => r.mode('add')}><Icon name="add" size={16} /> Add opening</Button>
      <Button disabled={disabled || r.editor.selected.length < 2} onClick={r.merge} title="Merge selected leaves/duplicates of the same opening into one box"><Icon name="merge" size={16} /> Merge</Button>
      <Button className="icon-button" disabled={disabled || !r.editor.selected.length} onClick={r.remove} title="Delete selected boxes (Delete)" aria-label="Delete selected boxes"><Icon name="trash" size={16} /></Button>
      <Button className="icon-button" disabled={disabled || !r.editor.history.length} onClick={r.undo} title="Undo edit (⌘/Ctrl Z)" aria-label="Undo edit"><Icon name="undo" size={16} /></Button>
    </div>
    <div className="tool-group zoom-controls" aria-label="Zoom controls">
      <Button className="icon-button" disabled={!r.imageReady} onClick={() => setZoom(100)} title="Fit sheet" aria-label="Fit sheet"><Icon name="fit" size={16} /></Button>
      <Button className="icon-button" disabled={!r.imageReady || zoom <= 50} onClick={() => setZoom(Math.max(50, zoom - 25))} title="Zoom out" aria-label="Zoom out"><Icon name="minus" size={14} /></Button>
      <output aria-label="Zoom relative to fit">{zoom}%</output>
      <Button className="icon-button" disabled={!r.imageReady || zoom >= 600} onClick={() => setZoom(Math.min(600, zoom + 25))} title="Zoom in" aria-label="Zoom in"><Icon name="add" size={14} /></Button>
    </div>
  </div>
}
