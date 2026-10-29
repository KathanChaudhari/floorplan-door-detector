import type { ModelProvenance, OpeningBox, ReferenceResult } from '../door-review/types.ts'

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
