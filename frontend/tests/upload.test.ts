import assert from 'node:assert/strict'
import test from 'node:test'
import { validateUpload } from '../src/features/projects/upload.ts'

test('PDF and image uploads support MIME types and case-insensitive extension fallbacks', () => {
  for (const type of ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']) {
    assert.doesNotThrow(() => validateUpload({ name: 'plan', type, size: 1024 }))
  }
  for (const name of ['plan.pdf', 'plan.PNG', 'plan.jpg', 'plan.JPEG', 'plan.webp']) {
    assert.doesNotThrow(() => validateUpload({ name, type: '', size: 1024 }))
  }
})

test('unsupported formats and oversized uploads give actionable errors', () => {
  for (const name of ['plan.svg', 'plan.gif', 'plan.heic', 'plan.png.exe']) {
    assert.throws(() => validateUpload({ name, type: '', size: 1024 }), /Choose a PDF, PNG, JPEG or WebP file/)
  }
  assert.throws(() => validateUpload({ name: 'plan.png', type: 'image/png', size: 250 * 1024 * 1024 + 1 }), /smaller than 250 MB/)
})
