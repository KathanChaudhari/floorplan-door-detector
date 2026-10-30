import { ApiError, errorMessage, request } from '../../lib/http.ts'
import type { AppConfig, Job, SessionSummary } from './types.ts'

export const projectsApi = {
  config: (signal?: AbortSignal) => request<AppConfig>('/config', { signal }),
  sessions: (signal?: AbortSignal) => request<SessionSummary[]>('/jobs', { signal }),
  job: (id: string, signal?: AbortSignal) => request<Job>(`/jobs/${encodeURIComponent(id)}`, { signal }),
  upload: (file: File, progress: (percent: number) => void, signal?: AbortSignal): Promise<Job> => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const cleanup = () => signal?.removeEventListener('abort', abort)
    xhr.open('POST', '/api/jobs')
    xhr.responseType = 'json'
    xhr.timeout = 120_000
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100))
    }
    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as Job)
      else reject(new ApiError(errorMessage(xhr.response, `Upload failed (${xhr.status}).`), xhr.status))
    }
    xhr.onerror = () => { cleanup(); reject(new ApiError('Upload failed. Check the local backend connection.')) }
    xhr.ontimeout = () => { cleanup(); reject(new ApiError('Upload timed out. Refresh saved sessions before trying again; the backend may have received the file.')) }
    xhr.onabort = () => { cleanup(); reject(new DOMException('Upload cancelled.', 'AbortError')) }
    if (signal?.aborted) { reject(new DOMException('Upload cancelled.', 'AbortError')); return }
    signal?.addEventListener('abort', abort, { once: true })
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  }),
}
