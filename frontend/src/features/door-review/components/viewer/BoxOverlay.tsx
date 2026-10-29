import { useImperativeHandle, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, Ref } from 'react'
import { clientToPage, moveBoxes, openingDragKind, rectangle, resizeBox } from '../../editor.ts'
import type { Corner } from '../../editor.ts'
import type { Dimensions, EditMode, OpeningBox, Point, ReferenceBox } from '../../types.ts'

type Props = {
  ref?: Ref<BoxOverlayHandle>
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
  onInteractionChange: (active: boolean) => void
}
export type BoxOverlayHandle = { cancel: () => void }
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

export function BoxOverlay({ ref, size, boxes, reference, selected, mode, disabled, scale, onSelect, onChange, focusViewer, onInteractionChange }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [preview, setPreview] = useState<OpeningBox[] | null>(null)
  const [addition, setAddition] = useState<[Point, Point] | null>(null)
  const handleSize = 6 / Math.max(.01, scale)
  useImperativeHandle(ref, () => ({ cancel }))

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
    const kind = openingDragKind(id, corner)
    if (kind === 'add') {
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
      drag.current = { kind, id, corner: corner ?? undefined, start: at, end: at, boxes, ids, changed: false }
    }
    onInteractionChange(true)
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

  function cancel() {
    drag.current = null
    setPreview(null)
    setAddition(null)
    onInteractionChange(false)
  }

  return <svg ref={svg} className={`absolute inset-0 size-full touch-none overflow-visible select-none ${mode === 'add' ? 'cursor-crosshair' : ''}`} viewBox={`0 0 ${size.width} ${size.height}`}
    aria-label="Editable opening boxes" onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}>
    <g pointerEvents="none" aria-hidden="true">
      {reference.map((box) => <rect className="fill-none stroke-[#9459bc] stroke-1 [stroke-dasharray:5_4]" key={box.id} x={box.box[0]} y={box.box[1]} width={box.box[2] - box.box[0]} height={box.box[3] - box.box[1]} vectorEffect="non-scaling-stroke" />)}
    </g>
    {(preview ?? boxes).map((box, index) => {
      const [x, y, x2, y2] = box.box
      const active = selected.includes(box.id)
      const corners: [Corner, number, number][] = [['nw', x, y], ['ne', x2, y], ['sw', x, y2], ['se', x2, y2]]
      return <g key={box.id} data-box-id={box.id}>
        <rect className={`cursor-move focus-visible:fill-[#ffc05d25] focus-visible:stroke-[#bd7b1e] focus-visible:stroke-[1.25] focus-visible:outline-none ${active ? 'fill-[#ffc05d25] stroke-[#bd7b1e] stroke-[1.25]' : 'fill-[#236ad20b] stroke-[#236ad2] stroke-1 hover:fill-[#236ad21c] hover:stroke-[1.25]'}`} x={x} y={y} width={x2 - x} height={y2 - y} vectorEffect="non-scaling-stroke"
          role="button" tabIndex={disabled ? -1 : 0} aria-label={`Opening ${index + 1}`} aria-pressed={active}
          onKeyDown={(event) => {
            if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect([box.id]) }
          }} />
        {active && <text x={x} y={Math.max(12 / scale, y - 5 / scale)} fontSize={11 / scale} strokeWidth={3 / scale} className="fill-[#a46c1b] stroke-white font-semibold [paint-order:stroke]" pointerEvents="none">{index + 1}</text>}
        {active && selected.length === 1 && !disabled && corners.map(([corner, cx, cy]) =>
          <rect key={corner} className={`fill-white stroke-[#bd7b1e] stroke-1 ${corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`} data-corner={corner} x={cx - handleSize / 2} y={cy - handleSize / 2} width={handleSize} height={handleSize}
            vectorEffect="non-scaling-stroke" />)}
      </g>
    })}
    {addition && <rect className="fill-[#236ad214] stroke-[#236ad2] stroke-1 [stroke-dasharray:4_3]" x={rectangle(...addition)[0]} y={rectangle(...addition)[1]}
      width={Math.abs(addition[1].x - addition[0].x)} height={Math.abs(addition[1].y - addition[0].y)} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
  </svg>
}
