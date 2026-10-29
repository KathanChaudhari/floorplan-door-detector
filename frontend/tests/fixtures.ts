import type { OpeningBox } from '../src/features/door-review/types.ts'
import type { Job } from '../src/features/projects/types.ts'
import type { Sheet } from '../src/features/sheets/types.ts'

export const box = (id: string, rect: OpeningBox['box']): OpeningBox => ({ id, box: rect, source: 'v3', score: .87 })
export const first = box('one', [10, 20, 30, 45])
export const second = box('two', [40, 25, 65, 55])
export const size = { width: 100, height: 80 }
export const sheet = (overrides: Partial<Sheet> = {}): Sheet => ({
  number: 1, point_size: [72, 72], ...size, boxes: [first], revision: 4,
  reviewed: true, detected: true, reference: null, base_model: null, ...overrides,
})
export const job = (pages: Sheet[], selected: number[]): Job => ({
  id: 'unit-test-fixture', name: 'Fixture.pdf', status: 'ready', message: '', dpi: 150,
  inference_settings: { threshold: .3, nms_iou: .5 }, source_sha256: 'fixture',
  pages, selected_pages: selected,
})
