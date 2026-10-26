import { Button } from '../../../components/ui/Button.tsx'
import { Icon } from '../../../components/ui/Icon.tsx'
import type { DoorReview } from '../hooks/useDoorReview.ts'

export function SessionSelector({ review: r }: { review: DoorReview }) {
  return <div className="session-selector">
    <label htmlFor="saved-document">Saved documents</label>
    <div className="session-selector__row">
      <select id="saved-document" value={r.job?.id ?? ''} disabled={r.busy || !r.config} onChange={(event) => void r.openSession(event.target.value)}>
        <option value="">Open a saved document…</option>
        {r.sessions.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.pages} sheets</option>)}
      </select>
      <Button variant="ghost" className="icon-button" title="Refresh saved documents" aria-label="Refresh saved documents" disabled={r.busy || !r.config} onClick={() => void r.refreshSessions()}><Icon name="refresh" size={16} /></Button>
    </div>
    {r.job && <button className="text-button" disabled={r.busy} onClick={() => void r.reload()}>Reload saved state</button>}
  </div>
}
