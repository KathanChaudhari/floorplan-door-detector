import { Button } from '../../../../components/ui/Button.tsx'
import { Icon } from '../../../../components/ui/Icon.tsx'
import type { EditMode } from '../../types.ts'
import { ZoomControls } from '../viewer/ZoomControls.tsx'
import { DetectionControls } from './DetectionControls.tsx'
import type { DetectionControlsProps } from './DetectionControls.tsx'

type Props = DetectionControlsProps & {
  imageReady: boolean
  mode: EditMode
  selectedCount: number
  canUndo: boolean
  zoom: number
  onZoomChange: (value: number) => void
  onModeChange: (mode: EditMode) => void
  onMerge: () => void
  onRemove: () => void
  onUndo: () => void
}

export function DetectionToolbar({ busy, imageReady, mode, selectedCount, canUndo, zoom, onZoomChange, onModeChange, onMerge, onRemove, onUndo, ...detection }: Props) {
  const disabled = busy || !imageReady
  return <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-white px-[18px] py-[11px] max-[1250px]:gap-2 max-[1250px]:px-3.5 max-[1250px]:[&_button]:gap-[5px] max-[1250px]:[&_button]:px-[7px] max-[1250px]:[&_button]:text-[11px]" aria-label="Detection and editing tools">
    <DetectionControls busy={busy} {...detection} />
    <div className="flex flex-wrap items-center gap-[5px] border-l border-border pl-2.5 max-[1250px]:pl-2 max-[650px]:gap-[3px] max-[650px]:border-0 max-[650px]:pl-0 min-[1250px]:[&_button]:px-2" role="group" aria-label="Box tools">
      <Button disabled={disabled} aria-pressed={mode === 'select'} onClick={() => onModeChange('select')}><Icon name="cursor" size={16} /> Select</Button>
      <Button disabled={disabled} aria-pressed={mode === 'add'} onClick={() => onModeChange('add')}><Icon name="add" size={16} /> Add opening</Button>
      <Button disabled={disabled || selectedCount < 2} onClick={onMerge} title="Merge selected leaves/duplicates of the same opening into one box"><Icon name="merge" size={16} /> Merge</Button>
      <Button size="icon" disabled={disabled || !selectedCount} onClick={onRemove} title="Delete selected boxes (Delete)" aria-label="Delete selected boxes"><Icon name="trash" size={16} /></Button>
      <Button size="icon" disabled={disabled || !canUndo} onClick={onUndo} title="Undo edit (⌘/Ctrl Z)" aria-label="Undo edit"><Icon name="undo" size={16} /></Button>
    </div>
    <ZoomControls ready={imageReady} zoom={zoom} onZoomChange={onZoomChange} />
  </div>
}
