import { checked, json, request } from '../../lib/http.ts'
import type { Job } from '../projects/types.ts'
import type { Sheet } from '../sheets/types.ts'
import type { EditRequest, ExportKind, ModelKey } from './types.ts'

export const reviewApi = {
  detect: (id: string, model: ModelKey) => request<Job>(`/jobs/${encodeURIComponent(id)}/detect`, json('POST', { model })),
  save: (id: string, number: number, edit: EditRequest) => request<Sheet>(`/jobs/${encodeURIComponent(id)}/pages/${number}`, json('PUT', edit)),
  export: async (id: string, kind: ExportKind) => (await checked(`/jobs/${encodeURIComponent(id)}/export/${kind}`)).blob(),
}
