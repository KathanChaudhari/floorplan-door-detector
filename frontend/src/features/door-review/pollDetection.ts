import { projectsApi } from '../projects/api.ts'
import type { Job } from '../projects/types.ts'

export const isDetecting = (job: Job | null) => job?.status === 'queued' || job?.status === 'running'

// A single cancellable polling loop; late replies cannot update another session.
export function pollDetection(jobId: string, onUpdate: (job: Job) => void, onError: (cause: unknown) => void) {
  const controller = new AbortController()
  let active = true
  let timer: ReturnType<typeof setTimeout>

  async function poll() {
    try {
      const latest = await projectsApi.job(jobId, controller.signal)
      if (!active) return
      onUpdate(latest)
      if (isDetecting(latest)) timer = setTimeout(poll, 1000)
    } catch (cause) {
      if (!active) return
      onError(cause)
      timer = setTimeout(poll, 2500)
    }
  }

  timer = setTimeout(poll, 350)
  return () => { active = false; clearTimeout(timer); controller.abort() }
}
