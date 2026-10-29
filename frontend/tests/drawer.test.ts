import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_DRAWER_WIDTH, resizeDrawerWidth } from '../src/pages/dashboard/drawer.ts'

test('dragging the drawer border resizes without closing it', () => {
  assert.equal(resizeDrawerWidth(DEFAULT_DRAWER_WIDTH, -1000, 1200), 220)
  assert.equal(resizeDrawerWidth(DEFAULT_DRAWER_WIDTH, 40, 1200), 320)
  assert.equal(resizeDrawerWidth(DEFAULT_DRAWER_WIDTH, 1000, 1200), 420)
})

test('drawer resizing stays within the viewport on narrow screens', () => {
  assert.equal(resizeDrawerWidth(280, 1000, 320), 272)
  assert.equal(resizeDrawerWidth(280, -1000, 320), 220)
  assert.equal(resizeDrawerWidth(280, 0, 240), 192)
})

test('keyboard-sized adjustments use the same drawer limits', () => {
  assert.equal(resizeDrawerWidth(280, 24, 1200), 304)
  assert.equal(resizeDrawerWidth(220, -24, 1200), 220)
  assert.equal(resizeDrawerWidth(420, 24, 1200), 420)
})
