import { Button } from '../../../components/ui/Button.tsx'
import { Icon } from '../../../components/ui/Icon.tsx'
import type { DoorReview } from '../hooks/useDoorReview.ts'
import type { ExportKind } from '../types.ts'

export function ExportActions({ review: r }: { review: DoorReview }) {
  const remaining = r.summary.selected - r.summary.reviewed
  const status = !r.summary.selected ? 'Select sheets in the sidebar to include them.'
    : r.editor.dirty ? 'Unsaved edits · save and confirm review to export.'
      : remaining ? `${remaining} selected sheet${remaining === 1 ? '' : 's'} still need review.` : 'All selected sheets reviewed. Ready to export.'
  return <footer className="export-footer">
    <div><strong>Reviewed export</strong><span aria-live="polite">{status}</span></div>
    <div className="export-buttons"><Icon name="download" size={16} />{(['json', 'csv', 'pdf'] as ExportKind[]).map((kind) =>
      <Button key={kind} disabled={r.busy || !r.summary.canExport} onClick={() => void r.exportReview(kind)}>{kind === 'pdf' ? 'Marked PDF' : kind.toUpperCase()}</Button>)}
    </div>
  </footer>
}
