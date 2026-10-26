import { useEffect, useReducer, useRef, useState } from 'react'
import { api, ApiError } from '../api.ts'
import { editorReducer, initialEditor, mergeBoxes, reviewSummary } from '../editor.ts'
import type { AppConfig, Dimensions, EditMode, ExportKind, Job, ModelKey, OpeningBox, SessionSummary } from '../types.ts'

const running = (job: Job | null) => job?.status === 'queued' || job?.status === 'running'
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'

export function useDoorReview() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [job, setJob] = useState<Job | null>(null)
  const [editor, dispatch] = useReducer(editorReducer, initialEditor)
  const [phase, setPhase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(true)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [imageReady, setImageReady] = useState(false)
  const [viewVersion, setViewVersion] = useState(0)
  const [showReference, setShowReference] = useState(false)
  const operation = useRef(false)
  const uploadController = useRef<AbortController | null>(null)
  const busy = phase !== null || running(job) || connecting
  const summary = reviewSummary(job, editor)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    Promise.all([api.config(controller.signal), api.sessions(controller.signal)])
      .then(([settings, saved]) => {
        if (!active) return
        setConfig(settings); setSessions(saved); setError(null)
      })
      .catch((cause: unknown) => { if (active) setError(message(cause)) })
      .finally(() => { if (active) setConnecting(false) })
    return () => { active = false; controller.abort() }
  }, [connectionAttempt])

  useEffect(() => () => uploadController.current?.abort(), [])

  const jobId = job?.id
  const jobStatus = job?.status
  const pageNumber = editor.page?.number
  useEffect(() => {
    if (!jobId || (jobStatus !== 'queued' && jobStatus !== 'running')) return
    const controller = new AbortController()
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const latest = await api.job(jobId, controller.signal)
        if (!active) return
        setJob(latest)
        const page = latest.pages.find((p) => p.number === pageNumber)
        if (page) dispatch({ type: 'sync', page })
        setError(null)
        if (running(latest)) timer = setTimeout(poll, 1000)
      } catch (cause) {
        if (!active) return
        setError(`${message(cause)} Checking detection status again in a moment; your saved results are retained.`)
        timer = setTimeout(poll, 2500)
      }
    }
    timer = setTimeout(poll, 350)
    // Abort and guard against late replies on session changes and StrictMode cleanup.
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [jobId, jobStatus, pageNumber])

  useEffect(() => {
    if (!editor.dirty && phase !== 'Saving changes…' && phase !== 'Confirming review…') return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [editor.dirty, phase])

  async function perform(label: string, action: () => Promise<void>) {
    if (operation.current || running(job) || connecting) return
    operation.current = true
    setPhase(label); setError(null)
    try {
      await action()
    } catch (cause) {
      const conflict = cause instanceof ApiError && cause.status === 409
      setError(message(cause) + (conflict && editor.dirty ? ' Your local edits have been kept. Save again or explicitly discard and reload.' : ''))
    } finally {
      operation.current = false; setPhase(null)
    }
  }

  function adopt(data: Job, number = data.selected_pages[0] || 1) {
    setJob(data)
    dispatch({ type: 'load', page: data.pages[number - 1] })
    setImageReady(false); setViewVersion((version) => version + 1); setShowReference(false)
  }

  async function saveCurrent(reviewed?: boolean) {
    if (!job || !editor.page || (!editor.dirty && reviewed === undefined)) return
    const page = await api.save(job.id, editor.page.number, {
      revision: editor.page.revision, boxes: editor.page.boxes, reviewed: reviewed ?? editor.page.reviewed,
    })
    setJob((current) => current?.id === job.id ? {
      ...current, pages: current.pages.map((p) => p.number === page.number ? page : p),
    } : current)
    dispatch({ type: 'saved', page })
  }

  async function upload(file: File) {
    await perform('Uploading PDF…', async () => {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') throw new Error('Choose a PDF file.')
      if (file.size > 250 * 1024 * 1024) throw new Error('Choose a PDF smaller than 250 MB.')
      await saveCurrent()
      const controller = new AbortController()
      uploadController.current = controller
      setUploadProgress(0)
      try {
        const data = await api.upload(file, setUploadProgress, controller.signal)
        adopt(data, 1) // Opening a sheet never selects it for detection/export.
        setSessions((current) => [{ id: data.id, name: data.name, pages: data.pages.length }, ...current].slice(0, 30))
      } finally {
        uploadController.current = null; setUploadProgress(null)
      }
    })
  }

  async function openSession(id: string) {
    if (!id || id === job?.id) return
    await perform('Opening saved document…', async () => { await saveCurrent(); adopt(await api.job(id)) })
  }

  async function openPage(number: number) {
    if (!job || number === editor.page?.number) return
    await perform('Opening sheet…', async () => {
      await saveCurrent()
      dispatch({ type: 'load', page: job.pages[number - 1] })
      setImageReady(false); setViewVersion((version) => version + 1)
    })
  }

  async function selectPage(number: number, checked: boolean) {
    if (!job) return
    await perform('Saving sheet selection…', async () => {
      await saveCurrent()
      const pages = new Set(job.selected_pages)
      if (checked) pages.add(number)
      else pages.delete(number)
      const data = await api.selection(job.id, [...pages].sort((a, b) => a - b))
      setJob(data)
      // The save may have advanced this sheet's revision; never restore the old one.
      const page = data.pages.find((p) => p.number === editor.page?.number)
      if (page) dispatch({ type: 'saved', page })
    })
  }

  async function detect(model: ModelKey) {
    if (!job) return
    await perform(`Queuing ${model.toUpperCase()}…`, async () => {
      await saveCurrent()
      setJob(await api.detect(job.id, model))
    })
  }

  function change(boxes: OpeningBox[], selected?: string[]) {
    if (!operation.current && !running(job) && imageReady) dispatch({ type: 'change', boxes, selected })
  }

  function select(ids: string[]) {
    if (!operation.current && !running(job)) dispatch({ type: 'select', ids })
  }

  function mode(value: EditMode) {
    if (!operation.current && !running(job)) dispatch({ type: 'mode', mode: value })
  }

  function remove() {
    if (editor.page && editor.selected.length) change(editor.page.boxes.filter((b) => !editor.selected.includes(b.id)), [])
  }

  function merge() {
    if (!editor.page || editor.selected.length < 2) return
    const id = crypto.randomUUID()
    change(mergeBoxes(editor.page.boxes, editor.selected, id), [id])
  }

  function undo() {
    if (!operation.current && !running(job) && imageReady) dispatch({ type: 'undo' })
  }

  async function reload() {
    if (!job) return
    if (editor.dirty && !window.confirm('Discard your unsaved edits and reload the saved document? This cannot be undone.')) return
    await perform('Reloading saved state…', async () => adopt(await api.job(job.id), editor.page?.number))
  }

  async function exportReview(kind: ExportKind) {
    if (!job || !summary.canExport) return
    await perform(`Preparing ${kind.toUpperCase()} export…`, async () => {
      const blob = await api.export(job.id, kind)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `door_review.${kind}`
      document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    })
  }

  function ready(size: Dimensions) {
    dispatch({ type: 'dimensions', size }); setImageReady(true)
    setJob((current) => current ? { ...current, pages: current.pages.map((p) => p.number === pageNumber ? { ...p, ...size } : p) } : current)
  }

  const pendingV3 = summary.pages.filter((p) => job?.selected_pages.includes(p.number) && !p.detected)
  const blockedV3 = pendingV3.some((p) => p.boxes.length > 0 || p.reviewed || p.revision > 0)
  return {
    config, sessions, job, editor, phase, error, connecting, busy, imageReady, viewVersion,
    uploadProgress, summary, showReference, setShowReference,
    canDetectV3: !!config?.available.v3 && pendingV3.length > 0 && !blockedV3,
    blockedV3,
    canDetectV4: !!config?.available.v4 && summary.pages.some((p) => job?.selected_pages.includes(p.number) && !p.reference),
    upload, openSession, openPage, selectPage, detect, change, select, mode, remove, merge, undo, reload, exportReview, ready,
    save: () => perform('Saving changes…', () => saveCurrent()),
    review: () => perform('Confirming review…', () => saveCurrent(!editor.page?.reviewed)),
    refreshSessions: () => perform('Refreshing documents…', async () => setSessions(await api.sessions())),
    reconnect: () => { setConnecting(true); setConnectionAttempt((n) => n + 1) },
    dismissError: () => setError(null),
  }
}

export type DoorReview = ReturnType<typeof useDoorReview>
