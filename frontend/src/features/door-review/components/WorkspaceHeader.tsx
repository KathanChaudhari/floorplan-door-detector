import { Icon } from '../../../components/ui/Icon.tsx'

type Props = {
  documentName?: string
  device?: string
  status: string
  busy: boolean
  dirty: boolean
}

export function WorkspaceHeader({ documentName, device, status, busy, dirty }: Props) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark"><Icon name="door" size={25} /></span>
        <div><strong>Door Review</strong><small>DRAWING WORKSPACE</small></div>
      </div>
      <div className="document-heading">
        <Icon name="file" size={18} />
        <span title={documentName}>{documentName ?? 'No document open'}</span>
      </div>
      <div className={`header-status ${dirty ? 'is-unsaved' : ''}`} role="status">
        <span className={busy ? 'spinner' : 'connection-dot'} />
        {status}
      </div>
      <span className="local-badge">Local{device !== undefined ? ` · ${device.toUpperCase()}` : ''}</span>
    </header>
  )
}
