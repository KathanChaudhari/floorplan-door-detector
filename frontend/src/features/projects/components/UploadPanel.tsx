import { useId, useState } from 'react'
import { Icon } from '../../../components/ui/Icon.tsx'
import { buttonStyles } from '../../../components/ui/buttonStyles.ts'

type Props = { disabled: boolean; upload: (file: File) => Promise<unknown>; compact?: boolean }

export function UploadPanel({ disabled, upload, compact = false }: Props) {
  const id = useId()
  const [dragging, setDragging] = useState(false)
  const input = <input id={id} className="sr-only" type="file" accept="application/pdf,.pdf" disabled={disabled}
    onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
  if (compact) return <div className="relative focus-within:[&_label]:outline-3 focus-within:[&_label]:outline-offset-3 focus-within:[&_label]:outline-[#5da18e]">{input}<label htmlFor={id} aria-disabled={disabled} className={buttonStyles({ variant: 'primary', className: 'w-full' })}><Icon name="upload" /> Upload PDF</label></div>
  return <div className={`flex min-h-full flex-col items-center justify-center gap-3.5 p-8 text-center focus-within:[&>label]:outline-3 focus-within:[&>label]:outline-offset-3 focus-within:[&>label]:outline-[#5da18e] max-[650px]:gap-[11px] max-[650px]:p-5 ${dragging ? 'bg-[#e7f2e9] shadow-[inset_0_0_0_3px_#4b9b77]' : ''}`}
    onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }}
    onDragLeave={() => setDragging(false)}
    onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (!disabled && file) void upload(file) }}>
    <div className="relative mb-1.5 grid h-[88px] w-[78px] -rotate-4 place-items-center rounded-[10px] border border-[#cfdfd1] bg-[#f9fcf9] text-[#a7bcb0] shadow-[0_3px_8px_#263e2920]" aria-hidden="true"><Icon name="file" size={44} /><span className="absolute -right-2.5 bottom-1 grid size-[33px] rotate-4 place-items-center rounded-[7px] border border-[#b8d3c2] bg-white text-[#5e9477]"><Icon name="door" size={20} /></span></div>
    <h2 className="text-[22px] font-[550] tracking-[-.6px] text-[#3f5d4a] max-[650px]:text-[18px]">Open a floor plan</h2>
    <p className="max-w-80 text-[12px] leading-[1.8] text-[#86998a] max-[650px]:text-[10px]">Upload a PDF, then choose the enlarged sheets you want to review.</p>
    {input}<label htmlFor={id} aria-disabled={disabled} className={buttonStyles({ variant: 'primary', size: 'upload', className: 'mt-1' })}><Icon name="upload" /> Choose a PDF</label>
    <small className="text-[10px] text-[#91a093]">or drop it here · PDF up to 250 MB</small>
    <div className="mt-[23px] flex gap-5 text-[9px] text-[#9aab9d] max-[650px]:hidden [&_b]:ml-[5px] [&_b]:font-[450] [&_b]:text-[#839686]"><span>01 <b>Select sheets</b></span><span>02 <b>Review openings</b></span><span>03 <b>Export counts</b></span></div>
  </div>
}
