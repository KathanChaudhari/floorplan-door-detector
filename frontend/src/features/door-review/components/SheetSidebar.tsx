import { Icon } from '../../../components/ui/Icon.tsx'
import type { DoorReview } from '../hooks/useDoorReview.ts'
import { SessionSelector } from './SessionSelector.tsx'
import { UploadPanel } from './UploadPanel.tsx'

export function SheetSidebar({ review: r }: { review: DoorReview }) {
  return <aside className="sidebar" aria-label="Documents and sheets">
    <div className="sidebar-section">
      <div className="section-label">DOCUMENTS</div>
      <UploadPanel compact disabled={r.busy || !r.config} upload={r.upload} />
      <SessionSelector review={r} />
    </div>
    <div className="sidebar-section sheets-heading">
      <div className="section-heading"><h2>Plan sheets</h2><span>{r.job?.pages.length ?? 0}</span></div>
      <p>Check enlarged floor plans to include them. Opening a sheet does not select it.</p>
    </div>
    <div className="sheet-list">
      {!r.job && <div className="sidebar-placeholder"><Icon name="layers" size={24} /><p>Your sheets will appear here.</p></div>}
      {r.summary.pages.map((page) => <div key={page.number} className={`sheet-row ${page.number === r.editor.page?.number ? 'is-current' : ''}`}>
        <input type="checkbox" aria-label={`Include sheet ${page.number}`} checked={r.job?.selected_pages.includes(page.number) ?? false} disabled={r.busy}
          onChange={(event) => void r.selectPage(page.number, event.target.checked)} />
        <button type="button" className="sheet-open" aria-current={page.number === r.editor.page?.number ? 'page' : undefined} disabled={r.busy} onClick={() => void r.openPage(page.number)}>
          <span className="sheet-thumbnail" aria-hidden="true"><Icon name="file" size={26} /><b>{String(page.number).padStart(2, '0')}</b></span>
          <span className="sheet-row__text"><strong>Sheet {page.number}</strong><small className={page.reviewed ? 'text-success' : ''}>{page.reviewed ? `✓ ${page.boxes.length} reviewed` : page.detected || page.boxes.length ? `${page.boxes.length} draft openings` : 'Not detected'}</small></span>
          {r.editor.dirty && r.editor.page?.number === page.number && <span className="unsaved-dot" title="Unsaved edits" />}
        </button>
      </div>)}
    </div>
    <div className="sidebar-footer"><span className="connection-dot" /> Local workspace <span>{r.sessions.length} saved</span></div>
  </aside>
}
