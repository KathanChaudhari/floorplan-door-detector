import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { sheet } from './fixtures.ts'

test('the first render shows the dashboard tools and file drawer instead of an upload-only page', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' })
  try {
    const { default: App } = await server.ssrLoadModule('/src/app/App.tsx')
    const html = renderToStaticMarkup(createElement(App))
    assert.equal(html.match(/aria-label="Toggle sheet drawer"/g)?.length, 1)
    assert.ok(html.includes('aria-label="Resize sheet drawer"'))
    assert.ok(html.includes('aria-label="Select opening"'))
    assert.ok(html.includes('aria-label="Draw opening"'))
    assert.ok(html.includes('aria-label="Zoom out"'))
    assert.ok(html.includes('aria-label="Full view"'))
    const aside = html.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? ''
    const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? ''
    assert.ok(aside.includes('Upload PDF or image'))
    for (const type of ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']) {
      assert.ok(aside.includes(type))
    }
    assert.ok(!aside.includes('Confirm review'))
    assert.ok(main.includes('Confirm review'))
    assert.ok(!main.includes('type="file"'))
    assert.ok(!html.includes('aria-label="Save changes"'))
    assert.ok(!html.includes('aria-label="Review counts"'))
    assert.ok(main.includes('V3 model'))
    assert.ok(main.includes('V4 reference'))
    assert.ok(!html.includes('Click to toggle · drag'))
    const { SheetDrawer } = await server.ssrLoadModule('/src/pages/dashboard/SheetDrawer.tsx')
    const renderDrawer = (detected: boolean) => renderToStaticMarkup(createElement(SheetDrawer, {
      open: true, onOpenChange: () => {}, documents: [], pages: [sheet({ boxes: [], detected, reviewed: false })],
      selectedPages: [], page: null, dirty: false, busy: false, uploadDisabled: false, showReference: false,
      onUpload: async () => {}, onOpenDocument: async () => {}, onOpenPage: async () => {}, onSelectPage: async () => {}, onShowReferenceChange: () => {},
    }))
    assert.ok(!renderDrawer(false).includes('0 openings'))
    assert.ok(renderDrawer(true).includes('0 openings'))
  } finally {
    await server.close()
  }
})
