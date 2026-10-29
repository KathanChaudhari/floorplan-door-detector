import assert from 'node:assert/strict'
import test from 'node:test'
import { pollDetection } from '../src/features/door-review/pollDetection.ts'
import { projectsApi } from '../src/features/projects/api.ts'
import type { Job } from '../src/features/projects/types.ts'
import { job, sheet } from './fixtures.ts'

const flush = async () => { await Promise.resolve(); await Promise.resolve() }

test('detection polling has one request per interval and stops when processing finishes', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const running: Job = { ...job([sheet()], [1]), status: 'running' }
  const finished = { ...running, status: 'ready' as const }
  let requests = 0
  const request = context.mock.method(projectsApi, 'job', async () => ++requests === 1 ? running : finished)
  const updates: Job[] = []
  const stop = pollDetection(running.id, (data) => updates.push(data), assert.fail)
  context.after(stop)
  context.mock.timers.tick(350)
  await flush()
  assert.equal(request.mock.callCount(), 1)
  context.mock.timers.tick(999)
  await flush()
  assert.equal(request.mock.callCount(), 1)
  context.mock.timers.tick(1)
  await flush()
  assert.equal(request.mock.callCount(), 2)
  assert.deepEqual(updates.map((data) => data.status), ['running', 'ready'])
  context.mock.timers.tick(10_000)
  await flush()
  assert.equal(request.mock.callCount(), 2)
})

test('switching sessions aborts the old request and ignores its late result', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let finish!: (data: Job) => void
  let signal: AbortSignal | undefined
  context.mock.method(projectsApi, 'job', async (_id: string, requestSignal?: AbortSignal) => {
    signal = requestSignal
    return new Promise<Job>((resolve) => { finish = resolve })
  })
  const updates: Job[] = []
  const errors: unknown[] = []
  const stop = pollDetection('old-session', (data) => updates.push(data), (cause) => errors.push(cause))
  context.mock.timers.tick(350)
  await flush()
  stop()
  assert.equal(signal?.aborted, true)
  finish(job([sheet()], [1]))
  await flush()
  assert.deepEqual(updates, [])
  assert.deepEqual(errors, [])
})

test('a failed status request retries once after the retry interval and cleanup cancels it', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const request = context.mock.method(projectsApi, 'job', async () => { throw new Error('Offline') })
  const errors: unknown[] = []
  const stop = pollDetection('saved-session', assert.fail, (cause) => errors.push(cause))
  context.mock.timers.tick(350)
  await flush()
  assert.equal(errors.length, 1)
  context.mock.timers.tick(2500)
  await flush()
  assert.equal(request.mock.callCount(), 2)
  stop()
  context.mock.timers.tick(10_000)
  await flush()
  assert.equal(request.mock.callCount(), 2)
})
