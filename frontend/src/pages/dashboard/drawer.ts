export const DEFAULT_DRAWER_WIDTH = 280

export function drawerWidth(startWidth: number, delta: number, viewportWidth: number) {
  const maximum = Math.max(0, Math.min(420, viewportWidth - 48))
  return Math.max(0, Math.min(startWidth + delta, maximum))
}

export function settleDrawerWidth(width: number, viewportWidth: number) {
  if (width < 120) return 0
  return drawerWidth(Math.max(220, width), 0, viewportWidth)
}
