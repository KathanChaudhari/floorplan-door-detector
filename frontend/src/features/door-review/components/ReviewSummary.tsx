import { Icon } from '../../../components/ui/Icon.tsx'
import type { ReviewSummary as ReviewSummaryData } from '../editor.ts'

type Props = { summary: Pick<ReviewSummaryData, 'selected' | 'reviewed' | 'openings'> }

export function ReviewSummary({ summary }: Props) {
  const progress = summary.selected ? summary.reviewed / summary.selected * 100 : 0

  return (
    <div className="review-summary" aria-label="Review progress">
      <div className="summary-item">
        <span className="summary-icon"><Icon name="layers" /></span>
        <div><span>Selected sheets</span><strong>{summary.selected}</strong></div>
      </div>
      <div className="summary-item">
        <span className="summary-icon"><Icon name="check" /></span>
        <div>
          <span>Sheets reviewed</span>
          <strong>{summary.reviewed}<small> / {summary.selected}</small></strong>
        </div>
        <div
          className="review-progress"
          role="progressbar"
          aria-label="Sheets reviewed"
          aria-valuemin={0}
          aria-valuemax={summary.selected || 1}
          aria-valuenow={summary.reviewed}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="summary-item summary-item--total">
        <span className="summary-icon"><Icon name="door" /></span>
        <div>
          <span>Reviewed openings</span>
          <strong aria-live="polite" data-testid="reviewed-count">{summary.openings}</strong>
        </div>
        <small>Selected, reviewed sheets only</small>
      </div>
    </div>
  )
}
