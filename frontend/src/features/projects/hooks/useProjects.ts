import { useEffect, useState } from 'react'
import { projectsApi } from '../api.ts'
import type { AppConfig, Job, SessionSummary } from '../types.ts'

export function useProjects() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [connecting, setConnecting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    Promise.all([projectsApi.config(controller.signal), projectsApi.sessions(controller.signal)])
      .then(([settings, saved]) => {
        if (!active) return
        setConfig(settings)
        setSessions(saved)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load saved documents.')
      })
      .finally(() => { if (active) setConnecting(false) })
    return () => { active = false; controller.abort() }
  }, [attempt])

  return {
    config, sessions, connecting, error,
    remember: (job: Job) => setSessions((current) => [
      { id: job.id, name: job.name, pages: job.pages.length },
      ...current.filter((session) => session.id !== job.id),
    ].slice(0, 30)),
    reconnect: () => { setConnecting(true); setAttempt((value) => value + 1) },
    dismissError: () => setError(null),
  }
}
