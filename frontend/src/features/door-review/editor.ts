import type { Job } from '../projects/types.ts'
import type { Sheet } from '../sheets/types.ts'
import type { Dimensions, EditMode, OpeningBox, Point, Rect } from './types.ts'

export type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number }
export type Corner = 'nw' | 'ne' | 'sw' | 'se'
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

// The matrix is the inverse of SVG.getScreenCTM(), including zoom and scroll.
export function clientToPage(point: Point, inverse: Matrix, size: Dimensions): Point {
  return {
    x: clamp(inverse.a * point.x + inverse.c * point.y + inverse.e, 0, size.width),
    y: clamp(inverse.b * point.x + inverse.d * point.y + inverse.f, 0, size.height),
  }
}

export function rectangle(start: Point, end: Point): Rect {
  return [Math.min(start.x, end.x), Math.min(start.y, end.y), Math.max(start.x, end.x), Math.max(start.y, end.y)]
}

export function moveBoxes(boxes: OpeningBox[], ids: string[], delta: Point, size: Dimensions): OpeningBox[] {
  const selected = boxes.filter((box) => ids.includes(box.id))
  if (!selected.length) return boxes
  const dx = clamp(delta.x, -Math.min(...selected.map((b) => b.box[0])), size.width - Math.max(...selected.map((b) => b.box[2])))
  const dy = clamp(delta.y, -Math.min(...selected.map((b) => b.box[1])), size.height - Math.max(...selected.map((b) => b.box[3])))
  return boxes.map((box) => ids.includes(box.id)
    ? { ...box, source: 'edited', box: [box.box[0] + dx, box.box[1] + dy, box.box[2] + dx, box.box[3] + dy] }
    : box)
}

export function resizeBox(boxes: OpeningBox[], id: string, corner: Corner, at: Point, size: Dimensions): OpeningBox[] {
  return boxes.map((box) => {
    if (box.id !== id) return box
    const rect: Rect = [...box.box]
    // Existing narrow boxes remain valid; resizing cannot invert or leave the page.
    const minWidth = Math.min(4, rect[2] - rect[0])
    const minHeight = Math.min(4, rect[3] - rect[1])
    if (corner.includes('w')) rect[0] = clamp(at.x, 0, rect[2] - minWidth)
    if (corner.includes('e')) rect[2] = clamp(at.x, rect[0] + minWidth, size.width)
    if (corner.includes('n')) rect[1] = clamp(at.y, 0, rect[3] - minHeight)
    if (corner.includes('s')) rect[3] = clamp(at.y, rect[1] + minHeight, size.height)
    return { ...box, box: rect, source: 'edited' }
  })
}

export function mergeBoxes(boxes: OpeningBox[], ids: string[], newId: string): OpeningBox[] {
  const selected = boxes.filter((box) => ids.includes(box.id))
  if (selected.length < 2) return boxes
  const union: OpeningBox = {
    id: newId, score: null, source: 'merged', box: [
      Math.min(...selected.map((b) => b.box[0])), Math.min(...selected.map((b) => b.box[1])),
      Math.max(...selected.map((b) => b.box[2])), Math.max(...selected.map((b) => b.box[3])),
    ],
  }
  return [...boxes.filter((box) => !ids.includes(box.id)), union]
}

export type EditorState = {
  page: Sheet | null
  dirty: boolean
  history: OpeningBox[][]
  selected: string[]
  mode: EditMode
}
export const initialEditor: EditorState = { page: null, dirty: false, history: [], selected: [], mode: 'select' }
export type EditorAction =
  | { type: 'load'; page: Sheet }
  | { type: 'sync'; page: Sheet }
  | { type: 'saved'; page: Sheet }
  | { type: 'dimensions'; size: Dimensions }
  | { type: 'change'; boxes: OpeningBox[]; selected?: string[] }
  | { type: 'select'; ids: string[] }
  | { type: 'mode'; mode: EditMode }
  | { type: 'undo' }

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'load') return { ...initialEditor, page: action.page }
  if (action.type === 'sync') {
    if (state.dirty) return state // A late response may never replace a local draft.
    if (state.page?.number !== action.page.number || state.page.revision !== action.page.revision) {
      return { ...initialEditor, page: action.page }
    }
    // V4/status updates preserve editing history, selection and editable boxes.
    return { ...state, page: { ...action.page, boxes: state.page.boxes } }
  }
  if (action.type === 'select') return { ...state, selected: action.ids }
  if (action.type === 'mode') return { ...state, mode: action.mode, selected: [] }
  if (!state.page) return state
  if (action.type === 'dimensions') return { ...state, page: { ...state.page, ...action.size } }
  if (action.type === 'saved') return { ...state, page: action.page, dirty: false }
  if (action.type === 'undo') {
    if (!state.history.length) return state
    return { ...state, dirty: true, selected: [], history: state.history.slice(0, -1),
      page: { ...state.page, boxes: state.history[state.history.length - 1], reviewed: false } }
  }
  if (action.type === 'change') {
    if (JSON.stringify(state.page.boxes) === JSON.stringify(action.boxes)) return state
    return { ...state, dirty: true, selected: action.selected ?? state.selected,
      history: [...state.history.slice(-39), state.page.boxes],
      page: { ...state.page, boxes: action.boxes, reviewed: false } }
  }
  return state
}

export function reviewSummary(job: Job | null, editor: EditorState) {
  const pages = job?.pages.map((page) => page.number === editor.page?.number ? editor.page : page) ?? []
  const selected = pages.filter((page) => job?.selected_pages.includes(page.number))
  const reviewed = selected.filter((page) => page.reviewed)
  return {
    pages, selected: selected.length, reviewed: reviewed.length,
    openings: reviewed.reduce((count, page) => count + page.boxes.length, 0),
    canExport: selected.length > 0 && selected.length === reviewed.length && !editor.dirty,
  }
}

export type ReviewSummary = ReturnType<typeof reviewSummary>
