import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_DRAWER_WIDTH, drawerWidth, settleDrawerWidth } from '../src/pages/dashboard/drawer.ts'

test('dragging can close the drawer and reopen it from the collapsed edge', () => {
  const collapsed = settleDrawerWidth(drawerWidth(DEFAULT_DRAWER_WIDTH, -220, 1200), 1200)
  assert.equal(collapsed, 0)
  const reopened = settleDrawerWidth(drawerWidth(collapsed, 250, 1200), 1200)
  assert.equal(reopened, 250)
  assert.equal(settleDrawerWidth(drawerWidth(0, 80, 1200), 1200), 0)
})

test('resizing stays within the available viewport and preserves room for the handle', () => {
  assert.equal(drawerWidth(280, 1000, 1200), 420)
  assert.equal(drawerWidth(280, -1000, 1200), 0)
  assert.equal(drawerWidth(280, 1000, 320), 272)
  assert.equal(settleDrawerWidth(150, 320), 220)
  assert.equal(settleDrawerWidth(300, 240), 192)
})

test('small drags snap closed while open drawers retain a usable minimum width', () => {
  assert.equal(settleDrawerWidth(119, 1200), 0)
  assert.equal(settleDrawerWidth(120, 1200), 220)
  assert.equal(settleDrawerWidth(310, 1200), 310)
})
