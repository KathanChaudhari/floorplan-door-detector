import { Button } from '../../../components/ui/Button.tsx'
import { Icon } from '../../../components/ui/Icon.tsx'
import type { ReviewSummary } from '../editor.ts'
import type { ExportKind } from '../types.ts'

type Props = {
  summary: Pick<ReviewSummary, 'selected' | 'reviewed' | 'canExport'>
  dirty: boolean
  busy: boolean
  onExport: (kind: ExportKind) => Promise<void>
}

const exportOptions: { kind: ExportKind; label: string }[] = [
  { kind: 'json', label: 'JSON' },
  { kind: 'csv', label: 'CSV' },
  { kind: 'pdf', label: 'Marked PDF' },
]

export function ExportActions({ summary, dirty, busy, onExport }: Props) {
  const remaining = summary.selected - summary.reviewed
  let status = 'All selected sheets reviewed. Ready to export.'
  if (!summary.selected) status = 'Select sheets in the sidebar to include them.'
  else if (dirty) status = 'Unsaved edits · save and confirm review to export.'
  else if (remaining) status = `${remaining} selected sheet${remaining === 1 ? '' : 's'} still need review.`

  return (
    <footer className="export-footer">
      <div><strong>Reviewed export</strong><span aria-live="polite">{status}</span></div>
      <div className="export-buttons">
        <Icon name="download" size={16} />
        {exportOptions.map(({ kind, label }) => (
          <Button key={kind} disabled={busy || !summary.canExport} onClick={() => void onExport(kind)}>
            {label}
          </Button>
        ))}
      </div>
    </footer>
  )
}
