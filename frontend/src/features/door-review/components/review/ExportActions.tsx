import { useState } from 'react'
import { Button } from '../../../../components/ui/Button.tsx'
import { Icon } from '../../../../components/ui/Icon.tsx'
import type { ExportKind } from '../../types.ts'

type Props = {
  canExport: boolean
  busy: boolean
  onExport: (kind: ExportKind) => Promise<void>
}

const exportOptions: { kind: ExportKind; label: string }[] = [
  { kind: 'pdf', label: 'Marked PDF' },
  { kind: 'csv', label: 'CSV' },
  { kind: 'json', label: 'JSON' },
]

export function ExportActions({ canExport, busy, onExport }: Props) {
  const [kind, setKind] = useState<ExportKind>('pdf')
  const disabled = busy || !canExport

  return <div className="flex items-center gap-1" aria-label="Export options" title={canExport ? 'Download reviewed sheets' : 'Confirm all selected sheets before exporting'}>
    <select className="h-[34px] max-w-28 rounded-md border border-border bg-white px-2 text-[11px] disabled:opacity-40"
      aria-label="Export format" value={kind} disabled={disabled} onChange={(event) => setKind(event.target.value as ExportKind)}>
      {exportOptions.map((option) => <option key={option.kind} value={option.kind}>{option.label}</option>)}
    </select>
    <Button size="icon" disabled={disabled} onClick={() => void onExport(kind)} aria-label="Download reviewed sheets" title="Download reviewed sheets">
      <Icon name="download" size={16} />
    </Button>
  </div>
}
