import assert from 'node:assert/strict'
import test from 'node:test'
import { AUTOSAVE_DELAY, scheduleAutosave } from '../src/features/door-review/autosave.ts'

test('automatic saving waits for the editing pause and writes once', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let writes = 0
  const cancel = scheduleAutosave(() => { writes += 1 }, () => true)
  context.after(cancel)
  context.mock.timers.tick(AUTOSAVE_DELAY - 1)
  assert.equal(writes, 0)
  context.mock.timers.tick(1)
  assert.equal(writes, 1)
  context.mock.timers.tick(10_000)
  assert.equal(writes, 1)
})

test('new edits or explicit operations cancel the pending save before it writes', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const saved: string[] = []
  const cancelPrevious = scheduleAutosave(() => saved.push('old draft'), () => true)
  context.mock.timers.tick(400)
  cancelPrevious()
  const cancelLatest = scheduleAutosave(() => saved.push('latest draft'), () => true)
  context.after(cancelLatest)
  context.mock.timers.tick(AUTOSAVE_DELAY - 1)
  assert.deepEqual(saved, [])
  context.mock.timers.tick(1)
  assert.deepEqual(saved, ['latest draft'])
})

test('the final guard prevents saving while another operation or drag is active', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let editing = false
  let writes = 0
  const cancel = scheduleAutosave(() => { writes += 1 }, () => !editing)
  context.after(cancel)
  editing = true
  context.mock.timers.tick(AUTOSAVE_DELAY)
  assert.equal(writes, 0)
  editing = false
  const afterEditing = scheduleAutosave(() => { writes += 1 }, () => !editing)
  context.after(afterEditing)
  context.mock.timers.tick(AUTOSAVE_DELAY)
  assert.equal(writes, 1)
})

test('unmount cleanup cancels a pending automatic save', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let saved = false
  const cancel = scheduleAutosave(() => { saved = true }, () => true)
  cancel()
  context.mock.timers.tick(10_000)
  assert.equal(saved, false)
})
