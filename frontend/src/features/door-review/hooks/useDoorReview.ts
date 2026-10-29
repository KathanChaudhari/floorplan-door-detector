import { useCallback, useEffect, useEffectEvent, useReducer, useRef, useState } from 'react'
import { ApiError } from '../../../lib/http.ts'
import { projectsApi } from '../../projects/api.ts'
import { useProjects } from '../../projects/hooks/useProjects.ts'
import type { Job } from '../../projects/types.ts'
import { sheetsApi } from '../../sheets/api.ts'
import { reviewApi } from '../api.ts'
import { scheduleAutosave } from '../autosave.ts'
import { editorReducer, initialEditor, mergeBoxes, reviewSummary } from '../editor.ts'
import { isDetecting, pollDetection } from '../pollDetection.ts'
import type { Dimensions, EditMode, ExportKind, ModelKey, OpeningBox } from '../types.ts'

const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'

// The dashboard owns one controller for the active document and editor.
export function useDoorReview() {
  const projects = useProjects()
  const { config, sessions, connecting } = projects
  const [job, setJob] = useState<Job | null>(null)
  const [editor, dispatch] = useReducer(editorReducer, initialEditor)
  const [phase, setPhase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [imageReady, setImageReady] = useState(false)
  const [viewVersion, setViewVersion] = useState(0)
  const [showReference, setShowReference] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const interaction = useRef(false)
  const pendingAutosave = useRef<(() => void) | null>(null)
  const operation = useRef(false)
  const sessionVersion = useRef(0)
  const uploadController = useRef<AbortController | null>(null)
  const busy = phase !== null || isDetecting(job) || connecting
  const summary = reviewSummary(job, editor)

  const autosave = useEffectEvent(() => { void save() })
  useEffect(() => {
    if (!editor.dirty || busy || interacting || error) return
    const cancel = scheduleAutosave(autosave, () => !operation.current && !interaction.current)
    pendingAutosave.current = cancel
    return () => {
      cancel()
      if (pendingAutosave.current === cancel) pendingAutosave.current = null
    }
  }, [editor.dirty, editor.page?.boxes, busy, interacting, error])

  useEffect(() => () => uploadController.current?.abort(), [])

  const jobId = job?.id
  const jobStatus = job?.status
  const pageNumber = editor.page?.number
  useEffect(() => {
    if (!jobId || (jobStatus !== 'queued' && jobStatus !== 'running')) return
    const version = sessionVersion.current
    return pollDetection(jobId, (latest) => {
      if (version !== sessionVersion.current) return
      setJob(latest)
      const page = latest.pages.find((item) => item.number === pageNumber)
      if (page) dispatch({ type: 'sync', page })
      setError(null)
    }, (cause) => {
      if (version === sessionVersion.current) {
        setError(`${message(cause)} Checking detection status again in a moment; your saved results are retained.`)
      }
    })
  }, [jobId, jobStatus, pageNumber])

  useEffect(() => {
    if (!editor.dirty && phase === null) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [editor.dirty, phase])

  async function perform(label: string, action: () => Promise<void>, allowDetection = false): Promise<boolean> {
    if (operation.current || interaction.current || (!allowDetection && (isDetecting(job) || connecting))) return false
    cancelAutosave()
    operation.current = true
    setPhase(label)
    setError(null)
    try {
      await action()
      return true
    } catch (cause) {
      const conflict = cause instanceof ApiError && cause.status === 409
      setError(message(cause) + (conflict && editor.dirty ? ' Your local edits have been kept. Retry saving or explicitly discard and reload.' : ''))
      return false
    } finally {
      operation.current = false
      setPhase(null)
    }
  }

  const adopt = useCallback((data: Job, number = data.selected_pages[0] ?? data.pages[0]?.number) => {
    const page = data.pages.find((item) => item.number === number)
    if (!page) throw new Error('This document has no available sheets.')
    sessionVersion.current += 1
    setJob(data)
    dispatch({ type: 'load', page })
    setImageReady(false)
    setViewVersion((version) => version + 1)
    setShowReference(false)
  }, [])

  async function saveCurrent(reviewed?: boolean) {
    if (!job || !editor.page || (!editor.dirty && reviewed === undefined)) return
    const page = await reviewApi.save(job.id, editor.page.number, {
      revision: editor.page.revision, boxes: editor.page.boxes, reviewed: reviewed ?? editor.page.reviewed,
    })
    setJob((current) => current?.id === job.id ? {
      ...current, pages: current.pages.map((item) => item.number === page.number ? page : item),
    } : current)
    dispatch({ type: 'saved', page })
  }

  async function openDocument(id: string): Promise<boolean> {
    if (!id) return false
    if (job?.id === id) return true
    return perform('Opening document…', async () => {
      await saveCurrent()
      adopt(await projectsApi.job(id))
    }, true)
  }

  async function save() {
    return perform('Saving changes…', () => saveCurrent())
  }

  function cancelAutosave() {
    pendingAutosave.current?.()
    pendingAutosave.current = null
  }

  function interact(active: boolean) {
    if (active) cancelAutosave()
    interaction.current = active
    setInteracting(active)
  }

  async function upload(file: File): Promise<string | null> {
    let createdId: string | null = null
    await perform('Uploading PDF…', async () => {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') throw new Error('Choose a PDF file.')
      if (file.size > 250 * 1024 * 1024) throw new Error('Choose a PDF smaller than 250 MB.')
      await saveCurrent()
      const controller = new AbortController()
      uploadController.current = controller
      setUploadProgress(0)
      try {
        const data = await projectsApi.upload(file, setUploadProgress, controller.signal)
        adopt(data, data.pages[0]?.number)
        projects.remember(data)
        createdId = data.id
      } finally {
        uploadController.current = null
        setUploadProgress(null)
      }
    })
    return createdId
  }

  async function openPage(number: number): Promise<boolean> {
    if (!job) return false
    if (number === editor.page?.number) return true
    return perform('Opening sheet…', async () => {
      const page = job.pages.find((item) => item.number === number)
      if (!page) throw new Error(`Sheet ${number} does not exist in this document.`)
      await saveCurrent()
      dispatch({ type: 'load', page })
      setImageReady(false)
      setViewVersion((version) => version + 1)
    }, true)
  }

  async function selectPage(number: number, checked: boolean) {
    if (!job) return false
    return perform('Saving sheet selection…', async () => {
      await saveCurrent()
      const pages = new Set(job.selected_pages)
      if (checked) pages.add(number)
      else pages.delete(number)
      const data = await sheetsApi.selection(job.id, [...pages].sort((a, b) => a - b))
      setJob(data)
      const page = data.pages.find((item) => item.number === editor.page?.number)
      if (page) dispatch({ type: 'saved', page })
    })
  }

  async function detect(model: ModelKey) {
    if (!job) return false
    return perform(`Queuing ${model.toUpperCase()}…`, async () => {
      await saveCurrent()
      if (model === 'v4') setShowReference(true)
      setJob(await reviewApi.detect(job.id, model))
    })
  }

  function change(boxes: OpeningBox[], selected?: string[]) {
    if (!operation.current && !isDetecting(job) && imageReady) {
      cancelAutosave()
      dispatch({ type: 'change', boxes, selected })
    }
  }

  function select(ids: string[]) {
    if (!operation.current && !isDetecting(job)) dispatch({ type: 'select', ids })
  }

  function mode(value: EditMode) {
    if (!operation.current && !isDetecting(job)) dispatch({ type: 'mode', mode: value })
  }

  function remove() {
    if (editor.page && editor.selected.length) change(editor.page.boxes.filter((box) => !editor.selected.includes(box.id)), [])
  }

  function merge() {
    if (!editor.page || editor.selected.length < 2) return
    const id = crypto.randomUUID()
    change(mergeBoxes(editor.page.boxes, editor.selected, id), [id])
  }

  function undo() {
    if (!operation.current && !isDetecting(job) && imageReady && editor.history.length > 0) {
      cancelAutosave()
      dispatch({ type: 'undo' })
    }
  }

  async function reload() {
    if (!job) return false
    if (editor.dirty && !window.confirm('Discard your unsaved edits and reload the saved document? This cannot be undone.')) return false
    return perform('Reloading saved state…', async () => adopt(await projectsApi.job(job.id), editor.page?.number))
  }

  async function exportReview(kind: ExportKind) {
    if (!job || !summary.canExport) return
    await perform(`Preparing ${kind.toUpperCase()} export…`, async () => {
      const blob = await reviewApi.export(job.id, kind)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `door_review.${kind}`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    })
  }

  function ready(size: Dimensions) {
    dispatch({ type: 'dimensions', size })
    setImageReady(true)
    setJob((current) => current ? { ...current, pages: current.pages.map((page) => page.number === pageNumber ? { ...page, ...size } : page) } : current)
  }

  const pendingV3 = summary.pages.filter((page) => job?.selected_pages.includes(page.number) && !page.detected)
  const blockedV3 = pendingV3.some((page) => page.boxes.length > 0 || page.reviewed || page.revision > 0)
  return {
    config, sessions, job, editor, phase, connecting, busy, imageReady, viewVersion,
    error: error ?? projects.error,
    uploadProgress, summary, showReference, setShowReference,
    canDetectV3: !!config?.available.v3 && pendingV3.length > 0 && !blockedV3,
    blockedV3,
    canDetectV4: !!config?.available.v4 && summary.pages.some((page) => job?.selected_pages.includes(page.number) && !page.reference),
    upload, openDocument, openPage, selectPage, detect, change, select, mode, remove, merge, undo, reload, exportReview, ready, save, interact,
    review: () => perform('Confirming review…', () => saveCurrent(!editor.page?.reviewed)),
    reconnect: projects.reconnect,
    dismissError: () => { setError(null); projects.dismissError() },
  }
}
