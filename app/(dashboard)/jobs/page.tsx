'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'

import { listEvents, listJobs, type BcDocumentKind, type Job, type LocalEvent } from '@/lib/data-client'
import {
  invoiceStatusLabels,
  invoiceStatuses,
  jobStatusLabels,
  jobStatuses,
  transportModeLabels,
  transportModes,
} from '@/domain/job/types'
import {
  emptyJobTableFilters,
  filterJobs,
  jobAgentOptions,
  sortJobsForTable,
  type JobListEvent,
  type JobTableFilters,
  type JobTableSort,
} from '@/lib/job-list'
import { Button } from '@/components/ui/button'
import { NewJobDialog } from '@/components/new-job-dialog'
import { JobCreateWizard } from '@/components/job-create-wizard'
import { PageSkeleton } from '@/components/loading-skeletons'
import { downloadCustomsWorkbook, label } from '@/components/job-row'
import { JobTable } from '@/components/job-table'

const selectClass = 'input m-0 w-full py-2 text-sm shadow-none focus-visible:outline-none lg:w-36 lg:flex-none'

function toListEvent(event: LocalEvent): JobListEvent {
  return {
    id: event.id,
    name: event.officialName,
    venueName: event.venue?.name ?? null,
    startsOn: event.startsOn && event.startsOn !== 'null' ? event.startsOn : null,
    endsOn: event.endsOn && event.endsOn !== 'null' ? event.endsOn : null,
  }
}

// Halaman ini tidak lagi khusus event: job dari event yang sudah selesai tetap tampil.
const initialFilters: JobTableFilters = { ...emptyJobTableFilters, activeOnly: false }

/**
 * Daftar semua job dalam satu tabel. No Job menjadi kolom pertama; pencarian lewat filter.
 * Bentuk inward manifest klien tersedia sebagai export Excel di halaman event.
 */
export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [filters, setFilters] = useState<JobTableFilters>(initialFilters)
  const [sort, setSort] = useState<JobTableSort | null>(null)
  const [showNewJob, setShowNewJob] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const initialLoadStarted = useRef(false)

  const load = useCallback((silent = false) => {
    Promise.all([listJobs(), listEvents()])
      .then(([loadedJobs, loadedEvents]) => {
        setJobs(loadedJobs)
        setEvents(loadedEvents)
        setLoadError('')
        setLoading(false)
      })
      .catch((caught) => {
        const message = caught instanceof Error ? caught.message : 'Data jobs tidak dapat dimuat.'
        if (silent) setToast({ message, tone: 'error' })
        else setLoadError(message)
        setLoading(false)
      })
  }, [])
  useEffect(() => {
    if (initialLoadStarted.current) return
    initialLoadStarted.current = true
    load()
  }, [load])
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const showToast = (message: string, tone: 'info' | 'error' = 'info') => setToast({ message, tone })
  async function generateCustomsWorkbook(job: Job, documentType: BcDocumentKind) {
    try {
      await downloadCustomsWorkbook(job, documentType)
      showToast(`${label(documentType)} berhasil diunduh.`)
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'File BC tidak dapat dibuat.', 'error')
    }
  }

  const eventById = useMemo(
    () => new Map(events.map((event) => [event.id, toListEvent(event)])),
    [events],
  )
  const rows = useMemo(
    () => sortJobsForTable(filterJobs(jobs, filters, eventById), eventById, sort),
    [jobs, filters, eventById, sort],
  )
  const agentOptions = useMemo(() => jobAgentOptions(jobs), [jobs])
  const setFilter = <K extends keyof JobTableFilters>(key: K, value: JobTableFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }))
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(initialFilters)

  if (loading) return <PageSkeleton cards={1} rows={8} />
  if (loadError)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            load()
          }}
          className="btn-secondary mt-3"
        >
          Coba lagi
        </button>
      </div>
    )

  return (
    <div className="space-y-6">
      <section aria-label="Filter job">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <label className="relative w-full lg:w-auto lg:min-w-48 lg:max-w-80 lg:flex-1">
            <span className="sr-only">Cari job</span>
            <Search className="absolute left-3 top-2.5 text-orange-500" size={18} aria-hidden="true" />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              className="input m-0 pl-10 shadow-none focus-visible:outline-none"
              placeholder="Cari No Job, B/L, invoice, agent, pihak"
            />
          </label>
          <select
            className={selectClass}
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value as JobTableFilters['status'])}
            aria-label="Filter status job"
          >
            <option value="">Semua status</option>
            {jobStatuses.map((status) => (
              <option key={status} value={status}>
                {jobStatusLabels[status]}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.transportMode}
            onChange={(event) => setFilter('transportMode', event.target.value as JobTableFilters['transportMode'])}
            aria-label="Filter moda"
          >
            <option value="">Semua moda</option>
            {transportModes.map((mode) => (
              <option key={mode} value={mode}>
                {transportModeLabels[mode]}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.invoiceStatus}
            onChange={(event) => setFilter('invoiceStatus', event.target.value as JobTableFilters['invoiceStatus'])}
            aria-label="Filter tagihan"
          >
            <option value="">Semua tagihan</option>
            {invoiceStatuses.map((status) => (
              <option key={status} value={status}>
                {invoiceStatusLabels[status]}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.agentId}
            onChange={(event) => setFilter('agentId', event.target.value)}
            aria-label="Filter agent"
          >
            <option value="">Semua agent</option>
            {agentOptions.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <Button type="button" onClick={() => setShowNewJob(true)} className="lg:ml-auto">
            <Plus data-icon="inline-start" />
            Job baru
          </Button>
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => setFilters(initialFilters)}
            className="mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800"
          >
            Reset filter
          </button>
        ) : null}
      </section>

      {rows.length ? (
        <JobTable jobs={rows} sort={sort} onSortChange={setSort} onGenerate={generateCustomsWorkbook} />
      ) : (
        <section className="card p-12 text-center">
          <p className="font-semibold text-slate-800">Tidak ada Job yang sesuai</p>
          <p className="mt-2 text-sm text-slate-500">
            {jobs.length
              ? 'Ubah pencarian atau filter untuk melihat Job lain.'
              : 'Belum ada job. Buat job baru dari tombol “Job baru”.'}
          </p>
        </section>
      )}

      {showNewJob && (
        <NewJobDialog
          onClose={() => setShowNewJob(false)}
          onSelectCategory={() => {
            setShowNewJob(false)
            setWizardOpen(true)
          }}
        />
      )}
      {wizardOpen && (
        <JobCreateWizard
          events={events}
          onCreated={(job) => router.push(`/jobs/${job.id}`)}
          onCancel={() => setWizardOpen(false)}
        />
      )}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
