import { Button } from '../../../components/ui/Button.tsx'
import { Icon } from '../../../components/ui/Icon.tsx'
import type { AppConfig, Job } from '../types.ts'

type Props = {
  error: string | null
  config: Pick<AppConfig, 'available'> | null
  job: Pick<Job, 'status' | 'message'> | null
  connecting: boolean
  busy: boolean
  dirty: boolean
  uploadProgress: number | null
  blockedV3: boolean
  onReconnect: () => void
  onSave: () => Promise<void>
  onReload: () => Promise<void>
  onDismissError: () => void
}

export function WorkspaceNotices({
  error, config, job, connecting, busy, dirty, uploadProgress, blockedV3,
  onReconnect, onSave, onReload, onDismissError,
}: Props) {
  return (
    <>
      {error && (
        <div className="error-banner" role="alert">
          <div><strong>Action needs attention</strong><p>{error}</p></div>
          <div className="error-actions">
            {!config && <Button disabled={connecting} onClick={onReconnect}>Retry connection</Button>}
            {dirty && (
              <>
                <Button disabled={busy} onClick={() => void onSave()}>Try saving again</Button>
                <Button disabled={busy} onClick={() => void onReload()}>Discard & reload</Button>
              </>
            )}
            <Button variant="ghost" className="icon-button" aria-label="Dismiss error" onClick={onDismissError}>
              <Icon name="close" size={16} />
            </Button>
          </div>
        </div>
      )}
      {uploadProgress !== null && (
        <div className="upload-progress" role="status">
          <span>{uploadProgress === 100 ? 'Reading PDF sheets…' : `Uploading PDF · ${uploadProgress}%`}</span>
          <progress max={100} value={uploadProgress} />
        </div>
      )}
      {(job?.status === 'error' || job?.status === 'interrupted') && (
        <div className="job-notice" role="status">
          {job.message} Completed results are retained. Select pending sheets and retry detection.
        </div>
      )}
      {config && !config.available.v3 && (
        <div className="job-notice">
          V3 checkpoint is unavailable. Check the backend model configuration before detection.
        </div>
      )}
      {blockedV3 && (
        <div className="job-notice">
          A selected undetected sheet already has edits. Keep those corrections, or open a new document to run V3 on that sheet.
        </div>
      )}
    </>
  )
}
