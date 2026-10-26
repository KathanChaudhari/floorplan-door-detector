import { Icon } from '../../../components/ui/Icon.tsx'
import type { DoorReview } from '../hooks/useDoorReview.ts'

export function ReviewSummary({ review: r }: { review: DoorReview }) {
  return <div className="review-summary" aria-label="Review progress">
    <div className="summary-item"><span className="summary-icon"><Icon name="layers" /></span><div><span>Selected sheets</span><strong>{r.summary.selected}</strong></div></div>
    <div className="summary-item"><span className="summary-icon"><Icon name="check" /></span><div><span>Sheets reviewed</span><strong>{r.summary.reviewed}<small> / {r.summary.selected}</small></strong></div>
      <div className="review-progress" role="progressbar" aria-label="Sheets reviewed" aria-valuemin={0} aria-valuemax={r.summary.selected || 1} aria-valuenow={r.summary.reviewed}><span style={{ width: `${r.summary.selected ? r.summary.reviewed / r.summary.selected * 100 : 0}%` }} /></div>
    </div>
    <div className="summary-item summary-item--total"><span className="summary-icon"><Icon name="door" /></span><div><span>Reviewed openings</span><strong aria-live="polite" data-testid="reviewed-count">{r.summary.openings}</strong></div><small>Selected, reviewed sheets only</small></div>
  </div>
}
