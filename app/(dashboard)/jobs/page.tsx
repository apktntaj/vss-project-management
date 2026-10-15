'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileWarning,
  Search,
  SlidersHorizontal,
  Upload,
} from 'lucide-react'
import {
  getOperationalDetails,
  listJobsWithEvents,
  saveJobDocument,
  type LocalEvent,
  type LocalJob,
  type LocalJobDocument,
} from '@/lib/data-client'
import type { BcDocumentKind } from '@/domain/job/types'
import { JobDocumentEditorDialog, type EditableJobDocument } from '@/components/job-document-editor-dialog'
import { Button } from '@/components/ui/button'
import { finishLoadingAfterMinimum, PageSkeleton } from '@/components/loading-skeletons'
import { getNextEventJobView, type EventJobViews } from '@/lib/event-job-view'
import {
  getJobOperationalPhase,
  jobOperationalPhases,
  type JobOperationalPhase,
} from '@/lib/job-operational-phase'
import { compareInvoiceWithTransport } from '@/lib/document-comparison'
import {
  JobRow,
  applyUploadedDocument,
  date,
  downloadCustomsWorkbook,
  isAcceptedJobDocument,
  jobDocumentAccept,
  label,
  type DocumentClassification,
  type JobDocumentExtraction,
} from '@/components/job-row'

type Scope = 'active' | 'all'

const activeEvent = (event: LocalEvent | undefined) =>
  !!event && new Date(`${event.endsOn}T23:59:59`) >= new Date()

function operationalPhaseFor(job: LocalJob) {
  const operational = getOperationalDetails(job)
  return getJobOperationalPhase({
    status: job.status,
    hasInboundDocument: Boolean(operational.inbound.documentNumber),
    hasInvoice: Boolean(operational.invoiceNumber),
    ciplStatus: operational.cipl.status,
    customsDocuments: Object.values(operational.customs),
  })
}

const exceptionalJobPhases: ReadonlyArray<JobOperationalPhase> = [
  { id: 'ON_HOLD', label: 'Perlu perhatian', description: 'Job yang sedang ditahan', nextAction: 'Buka job' },
  { id: 'CANCELLED', label: 'Dibatalkan', description: 'Job yang tidak dilanjutkan', nextAction: 'Buka job' },
]

function JobPhaseCard({
  job,
  phase,
  onDocumentUploaded,
  onToast,
  onEditDocument,
}: {
  job: LocalJob
  phase: JobOperationalPhase
  onDocumentUploaded: (jobId: string, document: LocalJobDocument, extraction?: JobDocumentExtraction) => void
  onToast: (message: string, tone?: 'info' | 'error') => void
  onEditDocument: (job: LocalJob, kind: EditableJobDocument) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const operational = getOperationalDetails(job)
  const documentComparison = operational.invoice && operational.inboundDocument
    ? compareInvoiceWithTransport(operational.invoice, operational.inboundDocument)
    : null
  const differences = documentComparison?.filter((item) => item.status === 'DIFFERENT') ?? []
  const documentSummary = [
    operational.inbound.documentNumber
      ? `${operational.inbound.documentType || 'Dokumen'} ${operational.inbound.documentNumber}`
      : null,
    operational.invoiceNumber ? `Invoice ${operational.invoiceNumber}` : null,
  ].filter(Boolean).join(' · ')

  async function uploadShipmentDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    const acceptedFiles = files.filter(isAcceptedJobDocument)
    if (acceptedFiles.length !== files.length) onToast('File harus berupa PDF atau Excel.', 'error')
    if (!acceptedFiles.length) return
    setUploading(true)
    try {
      for (const file of acceptedFiles) {
        try {
          const formData = new FormData()
          formData.set('file', file)
          const response = await fetch('/api/classify-job-document', { method: 'POST', body: formData })
          const payload = await response.json() as { classification?: DocumentClassification; error?: string } & JobDocumentExtraction
          if (!response.ok || !payload.classification) throw new Error(payload.error || 'Dokumen tidak dapat diperiksa.')
          const kind = payload.classification.documentType === 'UNREADABLE' ? 'OTHER' : payload.classification.documentType
          const document = await saveJobDocument(job.id, file, kind, payload.invoice, payload.transport)
          onDocumentUploaded(job.id, document, { invoice: payload.invoice, transport: payload.transport })
        } catch (caught) {
          const document = await saveJobDocument(job.id, file, 'OTHER')
          onDocumentUploaded(job.id, document)
          onToast(`Dokumen disimpan sebagai dokumen lain. ${caught instanceof Error ? caught.message : ''}`)
        }
      }
      onToast('Dokumen berhasil diunggah. Status job diperbarui berdasarkan kelengkapan dokumen.')
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat disimpan.', 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="min-w-0">
        <Link href={`/jobs/${job.id}`} className="block truncate font-semibold text-slate-900 hover:text-orange-700">
          {job.jobNumber}
        </Link>
        <p className="mt-1 truncate text-sm text-slate-600">{job.exhibitor?.legalName || job.clientName}</p>
      </div>
      <p className="mt-3 truncate text-xs text-slate-500" title={documentSummary || undefined}>
        {documentSummary || 'Dokumen belum lengkap'}
      </p>
      <p className="mt-2 text-xs text-slate-500">ETA: {date(operational.inbound.scheduleAt)}</p>
      <div className="mt-3 rounded-md bg-orange-50 px-2.5 py-2 text-xs font-medium text-orange-900">
        {phase.nextAction}
      </div>
      {phase.id === 'DRAFT' && <>
        <input ref={fileInputRef} type="file" multiple accept={jobDocumentAccept} onChange={uploadShipmentDocument} className="sr-only" tabIndex={-1} />
        <Button type="button" size="sm" className="mt-3 w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload data-icon="inline-start" />{uploading ? 'Mengunggah dokumen…' : 'Upload dokumen'}
        </Button>
        <p className="mt-2 text-xs text-slate-500">Upload B/L atau AWB dan Invoice untuk melanjutkan ke Prepare.</p>
      </>}
      {phase.id === 'PREPARE' && differences.length > 0 && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5">
        <p className="flex items-start gap-1.5 text-xs font-medium text-amber-900"><CircleAlert className="mt-0.5 shrink-0" size={14} aria-hidden="true" />{differences.length} data berbeda pada Invoice dan B/L/AWB.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => onEditDocument(job, 'INVOICE')}>Ubah Invoice</Button>
          <Button type="button" variant="outline" size="xs" onClick={() => onEditDocument(job, 'TRANSPORT')}>Ubah B/L/AWB</Button>
        </div>
      </div>}
      <Link href={`/jobs/${job.id}`} className="mt-3 inline-flex text-xs font-semibold text-orange-700 hover:text-orange-800">
        Buka job →
      </Link>
    </article>
  )
}

function JobPhaseChunk({ phase, jobs, onDocumentUploaded, onToast, onEditDocument }: {
  phase: JobOperationalPhase
  jobs: LocalJob[]
  onDocumentUploaded: (jobId: string, document: LocalJobDocument, extraction?: JobDocumentExtraction) => void
  onToast: (message: string, tone?: 'info' | 'error') => void
  onEditDocument: (job: LocalJob, kind: EditableJobDocument) => void
}) {
  return (
    <section className="flex min-h-[250px] flex-col rounded-xl border border-slate-200 bg-slate-50" aria-label={phase.label}>
      <header className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">{phase.label}</h2>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{jobs.length}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{phase.description}</p>
      </header>
      <div className="flex flex-1 flex-col gap-3 p-3">
        {jobs.map((job) => <JobPhaseCard key={job.id} job={job} phase={phase} onDocumentUploaded={onDocumentUploaded} onToast={onToast} onEditDocument={onEditDocument} />)}
        {!jobs.length && <p className="py-6 text-center text-xs text-slate-400">Tidak ada job</p>}
      </div>
    </section>
  )
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<LocalJob[]>([])
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [scope, setScope] = useState<Scope>('active')
  const [eventJobViews, setEventJobViews] = useState<EventJobViews>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  const [editingDocument, setEditingDocument] = useState<{ job: LocalJob; kind: EditableJobDocument } | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingStartedAt = useRef(Date.now())
  const initialLoadStarted = useRef(false)
  useEffect(() => {
    if (initialLoadStarted.current) return
    initialLoadStarted.current = true
    listJobsWithEvents().then(({ jobs: loadedJobs, events: loadedEvents }) => {
      setJobs(loadedJobs)
      setEvents(loadedEvents)
      setOpen(Object.fromEntries(loadedEvents.map((event) => [event.id, true])))
      finishLoadingAfterMinimum(loadingStartedAt.current, () => setLoading(false))
    })
  }, [])
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timeout)
  }, [toast])
  const showToast = (message: string, tone: 'info' | 'error' = 'info') => setToast({ message, tone })
  const handleDocumentSaved = (updated: LocalJob) => {
    setJobs((current) => current.map((job) => job.id === updated.id ? updated : job))
  }
  async function generateCustomsWorkbook(job: LocalJob, documentType: BcDocumentKind) {
    try {
      await downloadCustomsWorkbook(job, documentType)
      showToast(`${label(documentType)} berhasil diunduh.`)
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'File BC tidak dapat dibuat.', 'error')
    }
  }
  const handleDocumentUploaded = (jobId: string, document: LocalJobDocument, extraction?: JobDocumentExtraction) => {
    setJobs((current) =>
      current.map((job) => (job.id === jobId ? applyUploadedDocument(job, document, extraction) : job)),
    )
  }
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])
  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        const operational = getOperationalDetails(job)
        const haystack = [
          job.jobNumber,
          job.blNumber,
          job.awbNumber,
          operational.inbound.documentNumber,
          operational.outbound.documentNumber,
          ...Object.values(operational.customs).flatMap((item) =>
            item.billing.kind === 'INVOICED' || item.billing.kind === 'PAID'
              ? [item.billing.reference]
              : [],
          ),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return (
          (!search || haystack.includes(search.toLowerCase())) &&
          (!status || job.status === status) &&
          (scope === 'all' || activeEvent(job.eventId ? eventById.get(job.eventId) : undefined))
        )
      }),
    [jobs, search, status, scope, eventById],
  )
  const grouped = useMemo(
    () =>
      filtered.reduce<Record<string, LocalJob[]>>((all, job) => {
        const key = job.eventId || 'without-event'
        ;(all[key] ||= []).push(job)
        return all
      }, {}),
    [filtered],
  )
  const waitingCipl = filtered.filter(
    (job) => getOperationalDetails(job).cipl.status === 'MISSING',
  ).length
  const needsAction = filtered.filter((job) =>
    Object.values(getOperationalDetails(job).customs).some(
      (item) => item.applicable && item.status !== 'COMPLETED',
    ),
  ).length
  const activeJobs = jobs.filter((job) => job.status === 'IN_PROGRESS').length
  const pendingJobs = jobs.filter(
    (job) => job.status === 'DRAFT' || job.status === 'ON_HOLD',
  ).length
  const hasFilters = Boolean(search || status || scope !== 'active')
  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setScope('active')
  }
  if (loading) return <PageSkeleton cards={3} rows={6} />

  return (
    <div className="space-y-6">
      <section>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="mt-2 text-sm text-slate-500">Kelola milestone job berdasarkan tenggatnya.</p>
      </section>
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="card p-5" aria-labelledby="jobs-summary-title">
          <h2 id="jobs-summary-title" className="text-lg font-semibold">
            Summary
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-700">{activeJobs}</p>
              <p className="mt-1 text-xs text-slate-500">Job aktif</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{pendingJobs}</p>
              <p className="mt-1 text-xs text-slate-500">Job pending</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-700">{jobs.length}</p>
              <p className="mt-1 text-xs text-slate-500">Total job</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-semibold">Checkpoint event</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">Soon.</p>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-semibold">Attention</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div>
              <FileWarning className="mx-auto text-amber-700" size={18} />
              <p className="mt-1 text-2xl font-bold text-amber-700">{waitingCipl}</p>
              <p className="mt-1 text-xs text-slate-500">Menunggu CIPL</p>
            </div>
            <div>
              <SlidersHorizontal className="mx-auto text-orange-700" size={18} />
              <p className="mt-1 text-2xl font-bold text-orange-700">{needsAction}</p>
              <p className="mt-1 text-xs text-slate-500">Perlu tindak lanjut</p>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="mb-5 p-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative w-full lg:w-80 lg:flex-none">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input m-0 border-0 bg-slate-50 pl-10 shadow-none"
              placeholder="Cari nomor Job, B/L, AWB, atau invoice"
            />
          </label>
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 px-0 py-2">
            {[
              ['', 'All'],
              ['DRAFT', 'Draft'],
              ['IN_PROGRESS', 'On going'],
              ['ON_HOLD', 'On hold'],
              ['COMPLETED', 'Done'],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="job-status"
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                  className="h-4 w-4 accent-orange-600"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
            <button
              onClick={() => setScope('active')}
              className={`rounded-md px-3 py-1.5 ${scope === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Event aktif
            </button>
            <button
              onClick={() => setScope('all')}
              className={`rounded-md px-3 py-1.5 ${scope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Semua
            </button>
          </div>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800"
            >
              Reset filter
            </button>
          )}
        </div>
      </section>
      {Object.entries(grouped).map(([eventId, eventJobs]) => {
        const event = eventById.get(eventId)
        const isOpen = open[eventId] ?? true
        const showsCards = eventJobViews[eventId] ?? false
        const phasedJobs = eventJobs.map((job) => ({ job, phase: operationalPhaseFor(job) }))
        return (
          <section key={eventId} className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={() => setOpen((value) => ({ ...value, [eventId]: !isOpen }))}
                className="flex min-w-0 flex-1 items-center gap-3 text-left hover:text-orange-700"
                aria-expanded={isOpen}
              >
                <span className="text-slate-400">
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900">
                    {event?.officialName || 'Job tanpa event'}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {event
                      ? `${date(event.startsAt)} – ${date(event.endsAt)}`
                      : 'Perlu ditautkan ke event'}
                  </span>
                </span>
              </button>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                {eventJobs.length} Job
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={showsCards}
                aria-label={`Tampilkan ${event?.officialName || 'job tanpa event'} sebagai kartu`}
                title={showsCards ? 'Tampilkan sebagai baris' : 'Tampilkan sebagai kartu'}
                onClick={() => setEventJobViews((views) => getNextEventJobView(views, eventId))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 ${showsCards ? 'bg-orange-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${showsCards ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {isOpen && !showsCards && (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[115px]" />
                    <col className="w-[145px]" />
                    <col className="w-[190px]" />
                    <col className="w-[135px]" />
                    <col className="w-[210px]" />
                    <col className="w-[105px]" />
                  </colgroup>
                  <thead className="border-b bg-white text-slate-900 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3">No Job</th>
                      <th className="px-3 py-3">Exhibitor</th>
                      <th className="px-3 py-3">Dokumen shipment</th>
                      <th className="px-3 py-3">ETA</th>
                      <th className="px-3 py-3">Dokumen BC</th>
                      <th className="px-3 py-3">PIC (Inisiator)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventJobs.map((job) => (
                        <JobRow key={job.id} job={job} onDocumentUploaded={handleDocumentUploaded} onToast={showToast} onGenerate={generateCustomsWorkbook} onEditDocument={(selectedJob, kind) => setEditingDocument({ job: selectedJob, kind })} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {isOpen && showsCards && (
              <div className="overflow-x-auto">
                <div className="grid min-w-max grid-flow-col auto-cols-[260px] gap-4 p-5">
                  {exceptionalJobPhases.map((phase) => {
                    const jobs = phasedJobs.filter((item) => item.phase.id === phase.id).map((item) => item.job)
                    return jobs.length ? <JobPhaseChunk key={phase.id} phase={phase} jobs={jobs} onDocumentUploaded={handleDocumentUploaded} onToast={showToast} onEditDocument={(selectedJob, kind) => setEditingDocument({ job: selectedJob, kind })} /> : null
                  })}
                  {jobOperationalPhases.map((phase) => (
                    <JobPhaseChunk
                      key={phase.id}
                      phase={phase}
                      jobs={phasedJobs.filter((item) => item.phase.id === phase.id).map((item) => item.job)}
                      onDocumentUploaded={handleDocumentUploaded}
                      onToast={showToast}
                      onEditDocument={(selectedJob, kind) => setEditingDocument({ job: selectedJob, kind })}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )
      })}
      {!filtered.length && (
        <section className="card p-12 text-center">
          <p className="font-semibold text-slate-800">Tidak ada Job yang sesuai</p>
          <p className="mt-2 text-sm text-slate-500">
            Ubah pencarian atau filter untuk melihat Job lain.
          </p>
        </section>
      )}
      <JobDocumentEditorDialog
        job={editingDocument?.job ?? null}
        kind={editingDocument?.kind ?? 'INVOICE'}
        open={Boolean(editingDocument)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setEditingDocument(null) }}
        onSaved={handleDocumentSaved}
        onToast={showToast}
      />
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{toast.message}</div>}
    </div>
  )
}
