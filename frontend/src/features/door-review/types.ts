export type ModelKey = 'v3' | 'v4'
export type Rect = [number, number, number, number]
export type Point = { x: number; y: number }
export type Dimensions = { width: number; height: number }
export type OpeningBox = {
  id: string
  box: Rect
  score: number | null
  source: 'v3' | 'manual' | 'edited' | 'merged'
}
export type ReferenceBox = Omit<OpeningBox, 'source'> & { source: 'v4' }
export type ModelProvenance = {
  model: ModelKey
  checkpoint: string
  checkpoint_sha256: string
  rfdetr: string
  threshold: number
  nms_iou: number
  tile_size: number
  stride: number
}
export type ReferenceResult = {
  boxes: ReferenceBox[]
  model: ModelProvenance
  processing: Record<string, number>
  seconds: number
}
export type Sheet = {
  number: number
  point_size: [number, number]
  width: number | null
  height: number | null
  boxes: OpeningBox[]
  detected: boolean
  reviewed: boolean
  revision: number
  reference: ReferenceResult | null
  base_model: ModelProvenance | null
}
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
export type EditRequest = { revision: number; boxes: OpeningBox[]; reviewed: boolean }
export type ExportKind = 'json' | 'csv' | 'pdf'
export type EditMode = 'select' | 'add'
