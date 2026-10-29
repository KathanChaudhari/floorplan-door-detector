import type { ModelKey } from '../door-review/types.ts'
import type { Sheet } from '../sheets/types.ts'

export type Job = {
  id: string
  name: string
  status: 'ready' | 'queued' | 'running' | 'error' | 'interrupted'
  message: string
  dpi: number
  inference_settings: { threshold: number; nms_iou: number }
  source_sha256: string
  selected_pages: number[]
  pages: Sheet[]
}
export type SessionSummary = { id: string; name: string; pages: number }
export type AppConfig = {
  default_model: 'v3'
  reference_model: 'v4'
  device: string
  dpi: number
  available: Record<ModelKey, boolean>
}
