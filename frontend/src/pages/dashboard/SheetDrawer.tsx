import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Icon } from '../../components/ui/Icon.tsx'
import type { ReviewSummary } from '../../features/door-review/editor.ts'
import { UploadPanel } from '../../features/projects/components/UploadPanel.tsx'
import type { SessionSummary } from '../../features/projects/types.ts'
import type { Sheet } from '../../features/sheets/types.ts'
import { DEFAULT_DRAWER_WIDTH, drawerWidth, settleDrawerWidth } from './drawer.ts'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  documents: SessionSummary[]
  documentId?: string
  documentName?: string
  pages: Sheet[]
  selectedPages: number[]
  page: Sheet | null
  summary: Pick<ReviewSummary, 'selected' | 'reviewed' | 'openings'>
  dirty: boolean
  busy: boolean
  uploadDisabled: boolean
  imageReady: boolean
  showReference: boolean
  onUpload: (file: File) => Promise<unknown>
  onOpenDocument: (id: string) => Promise<unknown>
  onOpenPage: (number: number) => Promise<unknown>
  onSelectPage: (number: number, checked: boolean) => Promise<unknown>
  onReview: () => Promise<unknown>
  onShowReferenceChange: (show: boolean) => void
}

type Drag = { x: number; width: number; viewport: number; moved: boolean }

export function SheetDrawer({ open, onOpenChange, documents, documentId, documentName, pages, selectedPages, page, summary,
  dirty, busy, uploadDisabled, imageReady, showReference, onUpload, onOpenDocument, onOpenPage, onSelectPage, onReview, onShowReferenceChange }: Props) {
  const [width, setWidth] = useState(DEFAULT_DRAWER_WIDTH)
  const [previewWidth, setPreviewWidth] = useState<number | null>(null)
  const drawer = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  const drag = useRef<Drag | null>(null)
  const visible = open || previewWidth !== null

  function close() {
    onOpenChange(false)
    handle.current?.focus()
  }

  function start(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    const currentWidth = drawer.current?.getBoundingClientRect().width ?? 0
    drag.current = { x: event.clientX, width: currentWidth, viewport: window.innerWidth, moved: false }
    setPreviewWidth(currentWidth)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current) return
    const delta = event.clientX - current.x
    current.moved ||= Math.abs(delta) > 4
    setPreviewWidth(drawerWidth(current.width, delta, current.viewport))
  }

  function finish(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current) return
    drag.current = null
    const delta = event.clientX - current.x
    if (current.moved || Math.abs(delta) > 4) {
      const nextWidth = settleDrawerWidth(drawerWidth(current.width, delta, current.viewport), current.viewport)
      if (nextWidth) setWidth(nextWidth)
      onOpenChange(nextWidth > 0)
    } else {
      onOpenChange(!open)
    }
    setPreviewWidth(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function cancel() {
    drag.current = null
    setPreviewWidth(null)
  }

  return <>
    {open && <button type="button" aria-label="Close sheet drawer" className="absolute inset-0 z-10 bg-black/10 min-[768px]:hidden" onClick={close} />}
    <div ref={drawer} className={`absolute inset-y-0 left-0 z-20 max-w-[calc(100vw-48px)] shrink-0 bg-[#f8faf8] min-[768px]:relative ${previewWidth === null ? 'transition-[width] duration-200 motion-reduce:transition-none' : 'transition-none'}`}
      style={{ width: previewWidth ?? (open ? width : 0) }}>
      <div className="h-full overflow-hidden" inert={!visible}>
        <aside id="sheet-drawer" aria-label="Files and sheets" className="flex h-full min-w-[220px] flex-col border-r border-border" onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); close() }
        }}>
          <div className="space-y-3 border-b border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[12px] font-semibold">Sheets</h2>
              <Button variant="ghost" size="icon" onClick={close} aria-label="Close sheets"><Icon name="close" size={14} /></Button>
            </div>
            <UploadPanel compact disabled={uploadDisabled} upload={onUpload} />
            {documents.length > 0 && <select className="h-8 w-full min-w-0 rounded-md border border-border bg-white px-2 text-[11px]"
              aria-label="Open saved file" value={documentId ?? ''} disabled={busy} onChange={(event) => void onOpenDocument(event.target.value)}>
              <option value="">Open saved file…</option>
              {documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}
            </select>}
            {documentName && <p className="truncate text-[11px] text-muted" title={documentName}>{documentName}</p>}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted" aria-label="Review counts" aria-live="polite">
              <span>{summary.selected} selected</span>
              <span>{summary.reviewed} / {summary.selected} reviewed</span>
              <span>{summary.openings} openings</span>
            </div>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {pages.map((sheet) => <li key={sheet.number} className={`flex items-center gap-2 rounded-md border px-2 py-1 ${sheet.number === page?.number ? 'border-[#c4d9cc] bg-[#edf4ef]' : 'border-transparent'}`}>
              <input type="checkbox" className="size-[15px] shrink-0 cursor-pointer accent-accent" checked={selectedPages.includes(sheet.number)}
                disabled={busy} aria-label={`Include sheet ${sheet.number}`} onChange={(event) => void onSelectPage(sheet.number, event.target.checked)} />
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left disabled:opacity-60" disabled={busy}
                aria-current={sheet.number === page?.number ? 'page' : undefined} onClick={() => void onOpenPage(sheet.number)}>
                <Icon name="file" size={18} />
                <span className="flex-1 text-[11px]">Sheet {sheet.number}<small className="mt-1 block text-[10px] text-muted">{sheet.boxes.length} openings</small></span>
                {dirty && sheet.number === page?.number && <span className="size-[5px] rounded-full bg-[#bc8b32]" title="Unsaved edits" />}
                {sheet.reviewed && <span className="text-accent" title="Reviewed"><Icon name="check" size={14} /><span className="sr-only">Reviewed</span></span>}
              </button>
            </li>)}
            {!pages.length && <li className="p-3 text-[11px] text-muted">Upload a PDF to see its sheets.</li>}
          </ul>
          {page && <div className="space-y-3 border-t border-border p-3">
            <div className="flex items-center justify-between text-[11px]"><span>Sheet {page.number}</span><span className="text-muted">{page.boxes.length} openings</span></div>
            {page.reference && <label className="flex items-center gap-2 text-[11px] text-[#896aaf]">
              <input type="checkbox" className="size-[13px] accent-[#8b5ab7]" checked={showReference} onChange={(event) => onShowReferenceChange(event.target.checked)} />
              Show V4 · {page.reference.boxes.length}
            </label>}
            <Button className="w-full" variant={page.reviewed ? 'default' : 'primary'} disabled={busy || !imageReady} onClick={() => void onReview()}>
              <Icon name="check" size={15} />{page.reviewed ? 'Reopen review' : 'Confirm reviewed'}
            </Button>
          </div>}
        </aside>
      </div>
      <button ref={handle} type="button" className="absolute top-1/2 -right-5 flex h-16 w-5 -translate-y-1/2 touch-none cursor-ew-resize! items-center justify-center rounded-r-md border border-l-0 border-border bg-white text-muted shadow-sm select-none"
        aria-label={open ? 'Close sheet drawer' : 'Open sheet drawer'} aria-expanded={open} aria-controls="sheet-drawer"
        title="Click to toggle · drag to resize, close or open"
        onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}
        onClick={(event) => { if (event.detail === 0) onOpenChange(!open) }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const next = event.key === 'ArrowRight'
            ? drawerWidth(open ? width : 220, 32, window.innerWidth)
            : open && width > 220 ? Math.max(220, width - 32) : 0
          if (next) setWidth(next)
          onOpenChange(next > 0)
        }}>
        <Icon name={open ? 'chevronLeft' : 'chevronRight'} size={14} />
      </button>
    </div>
  </>
}
