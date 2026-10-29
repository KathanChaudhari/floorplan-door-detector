import { Button } from '../../../../components/ui/Button.tsx'
import { Icon } from '../../../../components/ui/Icon.tsx'
import type { ModelKey } from '../../types.ts'

export type DetectionControlsProps = {
  busy: boolean
  canDetectV3: boolean
  canDetectV4: boolean
  blockedV3: boolean
  onDetect: (model: ModelKey) => Promise<unknown>
}

export function DetectionControls({ busy, canDetectV3, canDetectV4, blockedV3, onDetect }: DetectionControlsProps) {
  return <div className="flex items-center gap-[5px] max-[650px]:gap-[3px]">
    <Button variant="primary" disabled={busy || !canDetectV3} onClick={() => void onDetect('v3')} title={blockedV3 ? 'An undetected selected sheet already has edits. Keep them, or upload a new document for detection.' : 'Detect unprocessed selected sheets with V3'}><Icon name="detect" size={16} /> Detect V3</Button>
    <Button disabled={busy || !canDetectV4} onClick={() => void onDetect('v4')} title="Run V4 on selected sheets as a separate reference"><Icon name="layers" size={16} /> V4 reference</Button>
  </div>
}
