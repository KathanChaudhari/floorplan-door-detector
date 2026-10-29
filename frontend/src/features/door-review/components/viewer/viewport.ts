import type { Point } from '../../types.ts'

export const MIN_ZOOM = 25
export const MAX_ZOOM = 600
export const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))

type Bounds = { left: number; top: number; width: number; height: number }
export type ZoomAnchor = { pageX: number; pageY: number; viewportX: number; viewportY: number }

export function zoomFromWheel(zoom: number, delta: number, deltaMode: number) {
  const pixels = delta * (deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1)
  return clampZoom(zoom * Math.exp(-Math.max(-200, Math.min(200, pixels)) * .005))
}

export function zoomAnchor(viewport: Bounds, sheet: Bounds, point: Point): ZoomAnchor {
  return {
    pageX: (point.x - sheet.left) / sheet.width,
    pageY: (point.y - sheet.top) / sheet.height,
    viewportX: point.x - viewport.left,
    viewportY: point.y - viewport.top,
  }
}

export function anchorScrollDelta(anchor: ZoomAnchor, viewport: Bounds, sheet: Bounds): Point {
  return {
    x: sheet.left + anchor.pageX * sheet.width - viewport.left - anchor.viewportX,
    y: sheet.top + anchor.pageY * sheet.height - viewport.top - anchor.viewportY,
  }
}

export function pinchGeometry(points: Point[]) {
  const [first, second] = points
  return {
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
  }
}
