import assert from 'node:assert/strict'
import test from 'node:test'
import { openingDragKind } from '../src/features/door-review/editor.ts'
import { anchorScrollDelta, clampZoom, pinchGeometry, zoomAnchor, zoomFromWheel } from '../src/features/door-review/components/viewer/viewport.ts'

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)

test('empty space draws, existing openings move and their handles resize without changing tools', () => {
  assert.equal(openingDragKind(undefined, null), 'add')
  assert.equal(openingDragKind('door-1', null), 'move')
  assert.equal(openingDragKind('door-1', 'nw'), 'resize')
  assert.equal(openingDragKind('door-1', 'se'), 'resize')
})

test('wheel zoom supports pixel and line deltas and enforces the view limits', () => {
  assert.ok(zoomFromWheel(100, -50, 0) > 100)
  assert.ok(zoomFromWheel(100, 50, 0) < 100)
  near(zoomFromWheel(100, 16, 0), zoomFromWheel(100, 1, 1))
  assert.equal(clampZoom(0), 25)
  assert.equal(clampZoom(1000), 600)
  assert.equal(zoomFromWheel(600, -100, 0), 600)
  assert.equal(zoomFromWheel(25, 100, 0), 25)
})

test('zoom anchoring keeps the page point under the pointer after the canvas resizes', () => {
  const viewport = { left: 0, top: 56, width: 800, height: 600 }
  const before = { left: 100, top: 156, width: 600, height: 400 }
  const anchor = zoomAnchor(viewport, before, { x: 250, y: 250 })
  const after = { left: 32, top: 88, width: 1200, height: 800 }
  const correction = anchorScrollDelta(anchor, viewport, after)
  near(correction.x, 82)
  near(correction.y, 26)
  const restored = anchorScrollDelta(anchor, viewport, { ...after, left: after.left - correction.x, top: after.top - correction.y })
  near(restored.x, 0)
  near(restored.y, 0)
})

test('two-finger geometry supports pinch zoom and panning without division by zero', () => {
  assert.deepEqual(pinchGeometry([{ x: 10, y: 20 }, { x: 40, y: 60 }]), { distance: 50, center: { x: 25, y: 40 } })
  assert.equal(pinchGeometry([{ x: 10, y: 20 }, { x: 10, y: 20 }]).distance, 1)
  const viewport = { left: 0, top: 0, width: 500, height: 500 }
  const sheet = { left: 0, top: 0, width: 500, height: 500 }
  const anchor = zoomAnchor(viewport, sheet, { x: 250, y: 250 })
  assert.deepEqual(anchorScrollDelta({ ...anchor, viewportX: 270, viewportY: 260 }, viewport, sheet), { x: -20, y: -10 })
})
