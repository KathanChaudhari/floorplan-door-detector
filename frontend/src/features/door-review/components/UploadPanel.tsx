import { useId, useState } from 'react'
import { Icon } from '../../../components/ui/Icon.tsx'

type Props = { disabled: boolean; upload: (file: File) => Promise<void>; compact?: boolean }

export function UploadPanel({ disabled, upload, compact = false }: Props) {
  const id = useId()
  const [dragging, setDragging] = useState(false)
  const input = <input id={id} className="visually-hidden" type="file" accept="application/pdf,.pdf" disabled={disabled}
    onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
  if (compact) return <div className="upload-compact">{input}<label htmlFor={id} className={`button button--primary ${disabled ? 'is-disabled' : ''}`}><Icon name="upload" /> Upload PDF</label></div>
  return <div className={`upload-empty ${dragging ? 'is-dragging' : ''}`}
    onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }}
    onDragLeave={() => setDragging(false)}
    onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (!disabled && file) void upload(file) }}>
    <div className="empty-drawing" aria-hidden="true"><Icon name="file" size={44} /><span><Icon name="door" size={20} /></span></div>
    <h2>Open a floor plan</h2>
    <p>Upload a PDF, then choose the enlarged sheets you want to review.</p>
    {input}<label htmlFor={id} className={`button button--primary ${disabled ? 'is-disabled' : ''}`}><Icon name="upload" /> Choose a PDF</label>
    <small>or drop it here · PDF up to 250 MB</small>
    <div className="empty-workflow"><span>01 <b>Select sheets</b></span><span>02 <b>Review openings</b></span><span>03 <b>Export counts</b></span></div>
  </div>
}
