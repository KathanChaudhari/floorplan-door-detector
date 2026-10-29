import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewApi } from '../src/features/door-review/api.ts'
import { editorReducer, initialEditor, reviewSummary } from '../src/features/door-review/editor.ts'
import { projectsApi } from '../src/features/projects/api.ts'
import { sheetsApi } from '../src/features/sheets/api.ts'
import { ApiError } from '../src/lib/http.ts'
import { first, job, second, sheet } from './fixtures.ts'

test('reopen, select, detect, correct, save, confirm and export keep the existing API contracts', async (context) => {
  let savedJob = job([
    sheet({ number: 1, boxes: [], detected: false, reviewed: false, revision: 0 }),
    sheet({ number: 2, boxes: [], detected: false, reviewed: false, revision: 0 }),
  ], [])
  const calls: { url: string; method: string; body: unknown }[] = []
  context.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : null
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body })
    if (url.endsWith('/selection')) {
      savedJob = { ...savedJob, selected_pages: body.pages }
      return Response.json(savedJob)
    }
    if (url.endsWith('/detect')) {
      assert.equal(body.model, 'v3')
      return Response.json({ ...savedJob, status: 'queued' })
    }
    if (url.endsWith('/pages/2')) {
      assert.deepEqual(Object.keys(body).sort(), ['boxes', 'reviewed', 'revision'])
      const page = savedJob.pages[1]
      assert.equal(body.revision, page.revision)
      const updated = { ...page, boxes: body.boxes, reviewed: body.reviewed, revision: page.revision + 1 }
      savedJob = { ...savedJob, pages: [savedJob.pages[0], updated] }
      return Response.json(updated)
    }
    if (url.endsWith('/export/json')) {
      return new Response('fixture-export', { headers: { 'Content-Type': 'application/json' } })
    }
    assert.equal(url, `/api/jobs/${savedJob.id}`)
    return Response.json(savedJob)
  })

  const reopened = await projectsApi.job(savedJob.id)
  assert.deepEqual(reopened.selected_pages, [])
  const selected = await sheetsApi.selection(savedJob.id, [2])
  assert.equal(reviewSummary(selected, initialEditor).canExport, false)
  assert.equal((await reviewApi.detect(savedJob.id, 'v3')).status, 'queued')
  // Synthetic completed inference result: the test does not invoke any model.
  savedJob = { ...savedJob, pages: [savedJob.pages[0], { ...savedJob.pages[1], detected: true, boxes: [first] }] }
  const completed = await projectsApi.job(savedJob.id)
  let editor = editorReducer(initialEditor, { type: 'load', page: completed.pages[1] })
  editor = editorReducer(editor, { type: 'change', boxes: [first, second] })
  assert.equal(editor.dirty, true)
  assert.equal(editor.page?.reviewed, false)
  const saved = await reviewApi.save(savedJob.id, 2, { revision: editor.page!.revision, boxes: editor.page!.boxes, reviewed: false })
  editor = editorReducer(editor, { type: 'saved', page: saved })
  assert.equal(editor.dirty, false)
  assert.equal(reviewSummary(savedJob, editor).canExport, false)
  const reviewed = await reviewApi.save(savedJob.id, 2, { revision: saved.revision, boxes: saved.boxes, reviewed: true })
  editor = editorReducer(editor, { type: 'saved', page: reviewed })
  const summary = reviewSummary(savedJob, editor)
  assert.equal(summary.canExport, true)
  assert.equal(summary.openings, 2)
  assert.equal(summary.selected, 1)
  assert.equal(await (await reviewApi.export(savedJob.id, 'json')).text(), 'fixture-export')
  assert.deepEqual(calls.map(({ method }) => method), ['GET', 'PUT', 'POST', 'GET', 'PUT', 'PUT', 'GET'])
})

test('invalid sessions and revision conflicts retain their backend status and message', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Saved session not found.' }, { status: 404 }))
  await assert.rejects(projectsApi.job('missing-session'), (error: unknown) => error instanceof ApiError && error.status === 404 && error.message === 'Saved session not found.')
  context.mock.method(globalThis, 'fetch', async () => Response.json({ detail: 'Revision conflict' }, { status: 409 }))
  await assert.rejects(reviewApi.save('saved-session', 1, { revision: 4, boxes: [first], reviewed: false }),
    (error: unknown) => error instanceof ApiError && error.status === 409 && error.message === 'Revision conflict')
})
