import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Point } from '../../types.ts'
import { anchorScrollDelta, clampZoom, pinchGeometry, zoomAnchor, zoomFromWheel } from './viewport.ts'
import type { ZoomAnchor } from './viewport.ts'

type Props = {
  viewport: RefObject<HTMLDivElement | null>
  sheet: RefObject<HTMLDivElement | null>
  zoom: number
  ready: boolean
  onZoomChange: (zoom: number) => void
  cancelEditing: () => void
}

type Pinch = { distance: number; zoom: number; anchor: ZoomAnchor }

function restoreAnchor(viewport: HTMLDivElement | null, sheet: HTMLDivElement | null, anchor: ZoomAnchor) {
  if (!viewport || !sheet) return
  const delta = anchorScrollDelta(anchor, viewport.getBoundingClientRect(), sheet.getBoundingClientRect())
  viewport.scrollBy({ left: delta.x, top: delta.y, behavior: 'instant' })
}

export function useViewerGestures({ viewport, sheet, zoom, ready, onZoomChange, cancelEditing }: Props) {
  const requestedZoom = useRef(zoom)
  const pendingAnchor = useRef<ZoomAnchor | null>(null)
  const touches = useRef(new Map<number, Point>())
  const pinch = useRef<Pinch | null>(null)
  const gesturing = useRef(false)
  const panPointer = useRef<number | null>(null)


  useLayoutEffect(() => {
    requestedZoom.current = zoom
    if (pendingAnchor.current) {
      restoreAnchor(viewport.current, sheet.current, pendingAnchor.current)
      pendingAnchor.current = null
    }
  }, [zoom, viewport, sheet])

  function changeZoom(next: number, anchor: ZoomAnchor) {
    const bounded = clampZoom(next)
    if (bounded === requestedZoom.current) {
      restoreAnchor(viewport.current, sheet.current, anchor)
      return
    }
    pendingAnchor.current = anchor
    requestedZoom.current = bounded
    onZoomChange(bounded)
  }

  function zoomAt(next: number, point?: Point) {
    if (!ready || !viewport.current || !sheet.current) return
    cancelEditing()
    const bounds = viewport.current.getBoundingClientRect()
    const at = point ?? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    changeZoom(next, zoomAnchor(bounds, sheet.current.getBoundingClientRect(), at))
  }

  const wheel = useEffectEvent((event: WheelEvent) => {
    if (!(event.ctrlKey || event.metaKey) || !ready) return
    event.preventDefault()
    zoomAt(zoomFromWheel(requestedZoom.current, event.deltaY, event.deltaMode), { x: event.clientX, y: event.clientY })
  })

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const listener = (event: WheelEvent) => wheel(event)
    element.addEventListener('wheel', listener, { passive: false })
    return () => element.removeEventListener('wheel', listener)
  }, [viewport])

  function beginPinch() {
    if (!viewport.current || !sheet.current) return
    const geometry = pinchGeometry([...touches.current.values()])
    pinch.current = {
      distance: geometry.distance,
      zoom: requestedZoom.current,
      anchor: zoomAnchor(viewport.current.getBoundingClientRect(), sheet.current.getBoundingClientRect(), geometry.center),
    }
  }

  function onPointerDownCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' || !ready) return
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (touches.current.size < 2) {
      if (!(event.target as Element).closest('[data-plan-sheet]')) {
        panPointer.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      return
    }
    event.preventDefault()
    event.stopPropagation()
    cancelEditing()
    gesturing.current = true
    beginPinch()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMoveCapture(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = touches.current.get(event.pointerId)
    if (!previous) return
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (!gesturing.current) {
      if (panPointer.current === event.pointerId) {
        event.currentTarget.scrollBy({ left: previous.x - event.clientX, top: previous.y - event.clientY, behavior: 'instant' })
      }
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (touches.current.size < 2 || !viewport.current) return
    if (!pinch.current) beginPinch()
    const current = pinch.current
    if (!current) return
    const geometry = pinchGeometry([...touches.current.values()])
    const bounds = viewport.current.getBoundingClientRect()
    changeZoom(current.zoom * geometry.distance / current.distance, {
      ...current.anchor,
      viewportX: geometry.center.x - bounds.left,
      viewportY: geometry.center.y - bounds.top,
    })
  }

  function onPointerEndCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch') return
    touches.current.delete(event.pointerId)
    if (panPointer.current === event.pointerId) panPointer.current = null
    if (gesturing.current) event.stopPropagation()
    pinch.current = null
    if (touches.current.size === 0) gesturing.current = false
  }

  function fitSheet() {
    cancelEditing()
    pendingAnchor.current = null
    requestedZoom.current = 100
    onZoomChange(100)
    viewport.current?.scrollTo({ left: 0, top: 0, behavior: 'instant' })
  }

  return { zoomAt, fitSheet, pointerHandlers: {
    onPointerDownCapture, onPointerMoveCapture,
    onPointerUpCapture: onPointerEndCapture, onPointerCancelCapture: onPointerEndCapture,
  } }
}
