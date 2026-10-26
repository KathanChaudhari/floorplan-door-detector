import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { clientToPage, moveBoxes, rectangle, resizeBox } from '../editor.ts'
import type { Corner } from '../editor.ts'
import type { Dimensions, EditMode, OpeningBox, Point, ReferenceBox } from '../types.ts'

type Props = {
  size: Dimensions
  boxes: OpeningBox[]
  reference: ReferenceBox[]
  selected: string[]
  mode: EditMode
  disabled: boolean
  scale: number
  onSelect: (ids: string[]) => void
  onChange: (boxes: OpeningBox[], selected?: string[]) => void
  focusViewer: () => void
}
type Drag = {
  kind: 'add' | 'move' | 'resize'
  start: Point
  end: Point
  boxes: OpeningBox[]
  ids: string[]
  id?: string
  corner?: Corner
  changed: boolean
}

export function BoxOverlay({ size, boxes, reference, selected, mode, disabled, scale, onSelect, onChange, focusViewer }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [preview, setPreview] = useState<OpeningBox[] | null>(null)
  const [addition, setAddition] = useState<[Point, Point] | null>(null)
  const handleSize = 9 / Math.max(.01, scale)

  function point(event: ReactPointerEvent<SVGSVGElement>): Point | null {
    const transform = svg.current?.getScreenCTM()
    if (!transform) return null
    return clientToPage({ x: event.clientX, y: event.clientY }, transform.inverse(), size)
  }

  function down(event: ReactPointerEvent<SVGSVGElement>) {
    if (disabled || event.button !== 0) return
    const at = point(event)
    if (!at) return
    event.preventDefault(); focusViewer()
    const target = event.target as Element
    const id = target.closest('[data-box-id]')?.getAttribute('data-box-id') ?? undefined
    const corner = target.getAttribute('data-corner') as Corner | null
    if (mode === 'add') {
      onSelect([])
      drag.current = { kind: 'add', start: at, end: at, boxes, ids: [], changed: false }
      setAddition([at, at])
    } else if (id) {
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        onSelect(selected.includes(id) ? selected.filter((key) => key !== id) : [...selected, id])
        return
      }
      const ids = selected.includes(id) ? selected : [id]
      onSelect(ids)
      drag.current = { kind: corner ? 'resize' : 'move', id, corner: corner ?? undefined, start: at, end: at, boxes, ids, changed: false }
    } else {
      onSelect([])
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (!current || disabled) return
    const at = point(event)
    if (!at) return
    current.end = at
    current.changed = current.changed || Math.abs(at.x - current.start.x) + Math.abs(at.y - current.start.y) > .1
    if (current.kind === 'add') { setAddition([current.start, at]); return }
    setPreview(current.kind === 'resize'
      ? resizeBox(current.boxes, current.id!, current.corner!, at, size)
      : moveBoxes(current.boxes, current.ids, { x: at.x - current.start.x, y: at.y - current.start.y }, size))
  }

  function finish(event: ReactPointerEvent<SVGSVGElement>) {
    const current = drag.current
    if (!current) return
    const at = point(event) ?? current.end
    if (!disabled && current.kind === 'add') {
      const rect = rectangle(current.start, at)
      if (rect[2] - rect[0] >= 4 && rect[3] - rect[1] >= 4) {
        const id = crypto.randomUUID()
        onChange([...current.boxes, { id, box: rect, score: null, source: 'manual' }], [id])
      }
    } else if (!disabled && current.changed) {
      const next = current.kind === 'resize'
        ? resizeBox(current.boxes, current.id!, current.corner!, at, size)
        : moveBoxes(current.boxes, current.ids, { x: at.x - current.start.x, y: at.y - current.start.y }, size)
      onChange(next, current.ids)
    }
    cancel()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function cancel() { drag.current = null; setPreview(null); setAddition(null) }

  return <svg ref={svg} className={`box-overlay ${mode === 'add' ? 'is-adding' : ''}`} viewBox={`0 0 ${size.width} ${size.height}`}
    aria-label="Editable opening boxes" onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}>
    <g className="reference-boxes" pointerEvents="none" aria-hidden="true">
      {reference.map((box) => <rect key={box.id} x={box.box[0]} y={box.box[1]} width={box.box[2] - box.box[0]} height={box.box[3] - box.box[1]} vectorEffect="non-scaling-stroke" />)}
    </g>
    {(preview ?? boxes).map((box, index) => {
      const [x, y, x2, y2] = box.box
      const active = selected.includes(box.id)
      const corners: [Corner, number, number][] = [['nw', x, y], ['ne', x2, y], ['sw', x, y2], ['se', x2, y2]]
      return <g key={box.id} data-box-id={box.id} className={active ? 'is-selected' : ''}>
        <rect className="opening-box" x={x} y={y} width={x2 - x} height={y2 - y} vectorEffect="non-scaling-stroke"
          role="button" tabIndex={disabled ? -1 : 0} aria-label={`Opening ${index + 1}`} aria-pressed={active}
          onKeyDown={(event) => {
            if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect([box.id]) }
          }} />
        {active && <text x={x} y={Math.max(12 / scale, y - 5 / scale)} fontSize={11 / scale} strokeWidth={3 / scale} className="box-number" pointerEvents="none">{index + 1}</text>}
        {active && selected.length === 1 && !disabled && corners.map(([corner, cx, cy]) =>
          <rect key={corner} className="resize-handle" data-corner={corner} x={cx - handleSize / 2} y={cy - handleSize / 2} width={handleSize} height={handleSize}
            vectorEffect="non-scaling-stroke" style={{ cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize' }} />)}
      </g>
    })}
    {addition && <rect className="addition-preview" x={rectangle(...addition)[0]} y={rectangle(...addition)[1]}
      width={Math.abs(addition[1].x - addition[0].x)} height={Math.abs(addition[1].y - addition[0].y)} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
  </svg>
}
