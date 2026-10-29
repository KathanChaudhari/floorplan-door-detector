export const DEFAULT_DRAWER_WIDTH = 280

// Resizing never closes the drawer; visibility belongs to the sidebar toggle.
export function resizeDrawerWidth(startWidth: number, delta: number, viewportWidth: number) {
  const maximum = Math.max(0, Math.min(420, viewportWidth - 48))
  const minimum = Math.min(220, maximum)
  return Math.max(minimum, Math.min(startWidth + delta, maximum))
}
