import { Button } from '../../../../components/ui/Button.tsx'
import { Icon } from '../../../../components/ui/Icon.tsx'
import type { EditMode } from '../../types.ts'
import { DetectionControls } from './DetectionControls.tsx'
import type { DetectionControlsProps } from './DetectionControls.tsx'

type Props = DetectionControlsProps & {
  imageReady: boolean
  mode: EditMode
  selectedCount: number
  canUndo: boolean
  reviewed: boolean
  onReview: () => Promise<unknown>
  onModeChange: (mode: EditMode) => void
  onMerge: () => void
  onRemove: () => void
  onUndo: () => void
}

export function DetectionToolbar({ busy, imageReady, mode, selectedCount, canUndo, reviewed, onReview, onModeChange, onMerge, onRemove, onUndo, ...detection }: Props) {
  const disabled = busy || !imageReady
  return <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-1.5" aria-label="Detection and editing tools">
    <DetectionControls busy={busy} {...detection} />
    <div className="flex items-center gap-1 border-l border-border pl-2" role="group" aria-label="Opening tools">
      <Button size="tool" disabled={disabled} aria-pressed={mode === 'select'} onClick={() => onModeChange('select')} title="Select or move an opening · drag empty space to draw" aria-label="Select opening"><Icon name="cursor" size={15} /></Button>
      <Button size="tool" disabled={disabled} aria-pressed={mode === 'add'} onClick={() => onModeChange('add')} title="Draw an opening by dragging empty space" aria-label="Draw opening"><Icon name="add" size={15} /></Button>
      <Button size="tool" disabled={disabled || selectedCount < 2} onClick={onMerge} title="Merge selected openings" aria-label="Merge selected openings"><Icon name="merge" size={15} /></Button>
      <Button size="tool" disabled={disabled || !selectedCount} onClick={onRemove} title="Delete selected openings (Delete)" aria-label="Delete selected openings"><Icon name="trash" size={15} /></Button>
      <Button size="tool" disabled={disabled || !canUndo} onClick={onUndo} title="Undo (⌘/Ctrl Z)" aria-label="Undo edit"><Icon name="undo" size={15} /></Button>
    </div>
    <Button className="ml-auto" variant={reviewed ? 'default' : 'primary'} disabled={disabled} onClick={() => void onReview()}>
      <Icon name="check" size={14} />{reviewed ? 'Reopen review' : 'Confirm review'}
    </Button>
  </div>
}
