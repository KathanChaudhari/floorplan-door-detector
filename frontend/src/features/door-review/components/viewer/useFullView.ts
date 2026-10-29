import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export function useFullView(frame: RefObject<HTMLElement | null>) {
  const [fullView, setFullView] = useState(false)
  const nativeActive = useRef(false)

  useEffect(() => {
    const changed = () => {
      if (frame.current && document.fullscreenElement === frame.current) nativeActive.current = true
      else if (nativeActive.current) {
        nativeActive.current = false
        setFullView(false)
      }
    }
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [frame])

  useEffect(() => {
    if (!fullView) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullView(false) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [fullView])

  async function toggleFullView() {
    if (fullView) {
      try {
        if (document.fullscreenElement === frame.current) await document.exitFullscreen()
      } catch {
        // Still leave the canvas-only layout if native fullscreen already ended.
      }
      setFullView(false)
      return
    }
    setFullView(true)
    try {
      await frame.current?.requestFullscreen?.()
    } catch {
      // The fixed canvas remains usable when native fullscreen is unavailable.
    }
  }

  return { fullView, toggleFullView }
}
