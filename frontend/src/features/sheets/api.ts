import { json, request } from '../../lib/http.ts'
import type { Job } from '../projects/types.ts'

export const sheetsApi = {
  image: (id: string, number: number) => `/api/jobs/${encodeURIComponent(id)}/pages/${number}/image`,
  selection: (id: string, pages: number[]) => request<Job>(`/jobs/${encodeURIComponent(id)}/selection`, json('PUT', { pages })),
}
