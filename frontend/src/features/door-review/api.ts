import type { AppConfig, EditRequest, ExportKind, Job, ModelKey, SessionSummary, Sheet } from './types.ts'

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object' || !('detail' in body)) return fallback
  const detail = body.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((item: { msg?: string }) => item.msg || 'Invalid request').join('; ')
  }
  return fallback
}

async function checked(path: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, init)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError('Cannot reach the local backend. Check that it is running on port 8765.')
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    throw new ApiError(errorMessage(body, `Request failed (${response.status}).`), response.status)
  }
  return response
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await checked(path, init)).json() as Promise<T>
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export const api = {
  config: (signal?: AbortSignal) => request<AppConfig>('/config', { signal }),
  sessions: (signal?: AbortSignal) => request<SessionSummary[]>('/jobs', { signal }),
  job: (id: string, signal?: AbortSignal) => request<Job>(`/jobs/${id}`, { signal }),
  image: (id: string, number: number) => `/api/jobs/${id}/pages/${number}/image`,
  selection: (id: string, pages: number[]) => request<Job>(`/jobs/${id}/selection`, json('PUT', { pages })),
  detect: (id: string, model: ModelKey) => request<Job>(`/jobs/${id}/detect`, json('POST', { model })),
  save: (id: string, number: number, edit: EditRequest) => request<Sheet>(`/jobs/${id}/pages/${number}`, json('PUT', edit)),
  export: async (id: string, kind: ExportKind) => (await checked(`/jobs/${id}/export/${kind}`)).blob(),
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
    xhr.ontimeout = () => { cleanup(); reject(new ApiError('Upload timed out. Refresh saved sessions before trying again; the backend may have received the PDF.')) }
    xhr.onabort = () => { cleanup(); reject(new DOMException('Upload cancelled.', 'AbortError')) }
    if (signal?.aborted) { reject(new DOMException('Upload cancelled.', 'AbortError')); return }
    signal?.addEventListener('abort', abort, { once: true })
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  }),
}
