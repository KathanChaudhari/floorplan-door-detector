import assert from 'node:assert/strict'
import test from 'node:test'
import { clientToPage, editorReducer, initialEditor, mergeBoxes, moveBoxes, rectangle, resizeBox, reviewSummary } from '../src/features/door-review/editor.ts'
import { errorMessage } from '../src/features/door-review/api.ts'
import type { Job, OpeningBox, Sheet } from '../src/features/door-review/types.ts'

const box = (id: string, rect: OpeningBox['box']): OpeningBox => ({ id, box: rect, source: 'v3', score: .87 })
const first = box('one', [10, 20, 30, 45])
const second = box('two', [40, 25, 65, 55])
const size = { width: 100, height: 80 }
const sheet = (overrides: Partial<Sheet> = {}): Sheet => ({
  number: 1, point_size: [72, 72], ...size, boxes: [first], revision: 4,
  reviewed: true, detected: true, reference: null, base_model: null, ...overrides,
})
const job = (pages: Sheet[], selected: number[]): Job => ({
  id: 'unit-test-fixture', name: 'Fixture.pdf', status: 'ready', message: '', dpi: 150,
  inference_settings: { threshold: .3, nms_iou: .5 }, source_sha256: 'fixture',
  pages, selected_pages: selected,
})

test('SVG inverse transform keeps the same page coordinate across zoom, scrolling, and translation', () => {
  const point = { x: 25, y: 40 }
  for (const scale of [.1, .5, 1, 4]) {
    for (const offset of [{ x: 120, y: 80 }, { x: -170, y: -300 }]) {
      const client = { x: point.x * scale + offset.x, y: point.y * scale + offset.y }
      assert.deepEqual(clientToPage(client, { a: 1 / scale, b: 0, c: 0, d: 1 / scale, e: -offset.x / scale, f: -offset.y / scale }, size), point)
    }
  }
})

test('coordinate transform supports off-axis affine terms and clamps to rendered pixels', () => {
  assert.deepEqual(clientToPage({ x: 5, y: 6 }, { a: 1, b: 2, c: 3, d: 1, e: 4, f: 8 }, size), { x: 27, y: 24 })
  assert.deepEqual(clientToPage({ x: -500, y: 900 }, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, size), { x: 0, y: 80 })
  assert.deepEqual(rectangle({ x: 50, y: 60 }, { x: 10, y: 20 }), [10, 20, 50, 60])
})

test('group move clamps the whole group, keeping spacing, IDs, scores, and untouched metadata', () => {
  const untouched = box('other', [80, 60, 90, 70])
  const moved = moveBoxes([first, second, untouched], ['one', 'two'], { x: -500, y: 500 }, size)
  assert.deepEqual(moved[0], { ...first, box: [0, 45, 20, 70], source: 'edited' })
  assert.deepEqual(moved[1], { ...second, box: [30, 50, 55, 80], source: 'edited' })
  assert.equal(moved[2], untouched)
  assert.deepEqual(first.box, [10, 20, 30, 45])
  assert.equal(new Set(moved.map((b) => b.id)).size, 3)
})

test('resizing cannot invert boxes or cross sheet edges, including very small existing detections', () => {
  assert.deepEqual(resizeBox([first], 'one', 'nw', { x: 500, y: -500 }, size)[0].box, [26, 0, 30, 45])
  assert.deepEqual(resizeBox([first], 'one', 'se', { x: -500, y: 500 }, size)[0].box, [10, 20, 14, 80])
  const tiny = box('tiny', [1, 1, 2, 2])
  assert.deepEqual(resizeBox([tiny], 'tiny', 'nw', { x: 20, y: 20 }, size)[0].box, [1, 1, 2, 2])
  assert.equal(resizeBox([first], 'one', 'ne', { x: 100, y: 0 }, size)[0].score, .87)
})

test('merging selected double-door leaves creates exactly one complete opening', () => {
  const other = box('other', [80, 60, 90, 70])
  const result = mergeBoxes([first, second, other], ['one', 'two'], 'union')
  assert.deepEqual(result, [other, { id: 'union', box: [10, 20, 65, 55], score: null, source: 'merged' }])
  assert.equal(mergeBoxes([first, second], ['one'], 'ignored').length, 2)
})

test('edits and undo clear review; successful save alone does not confirm review', () => {
  const loaded = editorReducer(initialEditor, { type: 'load', page: sheet() })
  const edited = editorReducer(loaded, { type: 'change', boxes: [first, second] })
  assert.equal(edited.dirty, true)
  assert.equal(edited.page?.reviewed, false)
  const saved = editorReducer(edited, { type: 'saved', page: sheet({ boxes: [first, second], reviewed: false, revision: 5 }) })
  assert.equal(saved.dirty, false)
  assert.equal(saved.page?.reviewed, false)
  assert.equal(saved.page?.revision, 5)
  const undone = editorReducer(saved, { type: 'undo' })
  assert.deepEqual(undone.page?.boxes, [first])
  assert.equal(undone.page?.reviewed, false)
  assert.equal(undone.dirty, true)
  assert.equal(undone.page?.revision, 5)
})

test('late server replies never replace an unsaved draft or silently advance its revision', () => {
  const loaded = editorReducer(initialEditor, { type: 'load', page: sheet() })
  const edited = editorReducer(loaded, { type: 'change', boxes: [second] })
  assert.equal(editorReducer(edited, { type: 'sync', page: sheet({ revision: 90, boxes: [] }) }), edited)
})

test('V4 reference sync preserves editable V3/manual state, selection, history, count and review', () => {
  const page = sheet()
  const state = { ...initialEditor, page, selected: ['one'], history: [[first, second]] }
  const reference: Sheet['reference'] = {
    boxes: [{ ...second, source: 'v4' }], seconds: 1, processing: {},
    model: { model: 'v4', checkpoint: 'fixture', checkpoint_sha256: 'fixture', rfdetr: '1.11.2', threshold: .3, nms_iou: .5, tile_size: 768, stride: 384 },
  }
  const updated = editorReducer(state, { type: 'sync', page: { ...page, reference } })
  assert.equal(updated.page?.boxes, state.page.boxes)
  assert.equal(updated.page?.reviewed, true)
  assert.equal(updated.page?.revision, 4)
  assert.equal(updated.history, state.history)
  assert.deepEqual(updated.selected, ['one'])
  assert.equal(reviewSummary(job([updated.page!], [1]), updated).openings, 1)
})

test('summary/export excludes unchecked sheets, unreviewed drafts and V4; reviewed zero is valid', () => {
  const firstPage = sheet()
  const secondPage = sheet({ number: 2, reviewed: false, boxes: [first, second] })
  const thirdPage = sheet({ number: 3, boxes: [first, second] })
  const data = job([firstPage, secondPage, thirdPage], [1, 2])
  assert.deepEqual(reviewSummary(data, initialEditor), { pages: data.pages, selected: 2, reviewed: 1, openings: 1, canExport: false })
  const dirty = editorReducer(editorReducer(initialEditor, { type: 'load', page: firstPage }), { type: 'change', boxes: [second] })
  assert.equal(reviewSummary(data, dirty).openings, 0)
  assert.equal(reviewSummary(data, dirty).canExport, false)
  assert.equal(reviewSummary(job([sheet({ boxes: [] })], [1]), initialEditor).canExport, true)
  assert.equal(reviewSummary(job([firstPage], []), initialEditor).selected, 0)
})

test('API errors preserve backend conflict and validation messages', () => {
  assert.equal(errorMessage({ detail: 'Revision conflict' }, 'fallback'), 'Revision conflict')
  assert.equal(errorMessage({ detail: [{ msg: 'Invalid box' }, { msg: 'Missing revision' }] }, 'fallback'), 'Invalid box; Missing revision')
  assert.equal(errorMessage(null, 'Connection failed'), 'Connection failed')
})
