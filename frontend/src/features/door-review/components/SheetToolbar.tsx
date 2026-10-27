import { Button } from '../../../components/ui/Button.tsx'
import { Icon } from '../../../components/ui/Icon.tsx'
import type { Sheet } from '../types.ts'

type Props = {
  page: Sheet | null
  dirty: boolean
  busy: boolean
  imageReady: boolean
  showReference: boolean
  onShowReferenceChange: (show: boolean) => void
  onSave: () => Promise<void>
  onReview: () => Promise<void>
}

export function SheetToolbar({
  page, dirty, busy, imageReady, showReference, onShowReferenceChange, onSave, onReview,
}: Props) {
  return (
    <div className="sheet-toolbar">
      <div className="sheet-heading">
        <strong>{page ? `Sheet ${page.number}` : 'Plan viewer'}</strong>
        {page && (
          <span className={`sheet-state ${page.reviewed ? 'is-reviewed' : ''}`}>
            {page.reviewed ? <Icon name="check" size={12} /> : <span className="state-dot" />}
            {page.reviewed ? 'Reviewed' : 'Draft'}
            <span className="state-divider">·</span>
            {page.boxes.length} openings
          </span>
        )}
      </div>
      <div className="review-actions">
        <label className="reference-toggle">
          <input
            type="checkbox"
            checked={showReference}
            disabled={!page?.reference}
            onChange={(event) => onShowReferenceChange(event.target.checked)}
          />
          <span>Show V4{page?.reference ? ` · ${page.reference.boxes.length}` : ''}</span>
        </label>
        <Button disabled={busy || !dirty} onClick={() => void onSave()}>
          <Icon name="save" size={15} /> Save changes
        </Button>
        <Button
          variant={page?.reviewed ? 'default' : 'primary'}
          disabled={busy || !imageReady}
          onClick={() => void onReview()}
        >
          <Icon name="check" size={15} />
          {page?.reviewed ? 'Reopen review' : 'Confirm reviewed'}
        </Button>
      </div>
    </div>
  )
}
