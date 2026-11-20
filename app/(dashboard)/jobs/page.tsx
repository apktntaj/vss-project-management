'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BriefcaseBusiness, Plus, RotateCcw, Search, TriangleAlert, X } from 'lucide-react'

import {
  listEvents,
  listJobs,
  type BcDocumentKind,
  type Job,
  type LocalEvent,
} from '@/lib/data-client'
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
import { toast } from '@/components/toast'
import { denyWrite } from '@/components/guarded-button'
import { useWriteAccess } from '@/lib/use-write-access'
import { creatableJenis, jobCreateDenialReason } from '@/lib/write-access'

const selectClass =
  'input m-0 h-10 w-full py-0 text-sm shadow-none focus-visible:outline-none lg:w-44 lg:flex-none'

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
  const wa = useWriteAccess()
  const [jobs, setJobs] = useState<Job[]>([])
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [filters, setFilters] = useState<JobTableFilters>(initialFilters)
  const [sort, setSort] = useState<JobTableSort | null>(null)
  const [showNewJob, setShowNewJob] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
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
        if (silent) toast(message, 'error')
        else setLoadError(message)
        setLoading(false)
      })
  }, [])
  useEffect(() => {
    if (initialLoadStarted.current) return
    initialLoadStarted.current = true
    load()
  }, [load])
  async function generateCustomsWorkbook(job: Job, documentType: BcDocumentKind) {
    try {
      await downloadCustomsWorkbook(job, documentType)
      toast(`${label(documentType)} berhasil diunduh.`, 'success')
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'File BC tidak dapat dibuat.', 'error')
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

  const creatableEvents = events.filter((event) => creatableJenis(wa, event.id).length > 0)
  const newJobDenial = jobCreateDenialReason(
    wa,
    events.map((event) => event.id),
  )
  const jobBaruButton = (
    <Button
      type="button"
      aria-disabled={newJobDenial !== null ? 'true' : undefined}
      onClick={() => {
        if (newJobDenial !== null) denyWrite(newJobDenial)
        else setShowNewJob(true)
      }}
      className="h-10 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 lg:ml-auto"
    >
      <Plus data-icon="inline-start" />
      Job baru
    </Button>
  )

  if (loading) return <PageSkeleton cards={1} rows={8} />
  if (loadError)
    return (
      <div
        className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        role="alert"
      >
        <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">Job tidak dapat dimuat</p>
          <p className="mt-0.5">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              load()
            }}
            className="btn-secondary mt-3"
          >
            <RotateCcw size={14} className="mr-1.5" aria-hidden="true" />
            Coba lagi
          </button>
        </div>
      </div>
    )

  return (
    <div className="space-y-4">
      <section aria-label="Filter job">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <label className="relative w-full lg:w-auto lg:min-w-56 lg:max-w-96 lg:flex-1">
            <span className="sr-only">Cari job</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={18}
              aria-hidden="true"
            />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              className="input m-0 h-10 pl-10 shadow-none focus-visible:outline-none"
              placeholder="Cari No Job, B/L, invoice, agent, pihak"
            />
          </label>
          <select
            className={selectClass}
            value={filters.status}
            onChange={(event) =>
              setFilter('status', event.target.value as JobTableFilters['status'])
            }
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
            onChange={(event) =>
              setFilter('transportMode', event.target.value as JobTableFilters['transportMode'])
            }
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
            onChange={(event) =>
              setFilter('invoiceStatus', event.target.value as JobTableFilters['invoiceStatus'])
            }
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
          {hasFilters ? (
            <button
              type="button"
              onClick={() => setFilters(initialFilters)}
              className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              <X size={14} aria-hidden="true" />
              Reset filter
            </button>
          ) : null}
          {jobBaruButton}
        </div>
      </section>

      {rows.length ? (
        <JobTable
          jobs={rows}
          sort={sort}
          onSortChange={setSort}
          onGenerate={generateCustomsWorkbook}
        />
      ) : (
        <section className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <BriefcaseBusiness size={24} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="mt-4 font-semibold text-slate-900">
            {jobs.length ? 'Tidak ada job yang sesuai' : 'Belum ada job'}
          </p>
          <p className="mt-1 max-w-sm text-sm text-slate-600">
            {jobs.length
              ? 'Ubah pencarian atau filter untuk melihat job lain.'
              : 'Buat job pertama untuk mulai mengelola kiriman.'}
          </p>
          <div className="mt-5">
            {jobs.length ? (
              <button
                type="button"
                onClick={() => setFilters(initialFilters)}
                className="btn-secondary"
              >
                Reset filter
              </button>
            ) : (
              jobBaruButton
            )}
          </div>
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
          events={creatableEvents}
          presetEvent={null}
          jenisFor={(eventId) => creatableJenis(wa, eventId)}
          onCreated={(job) => router.push(`/jobs/${job.id}`)}
          onCancel={() => setWizardOpen(false)}
        />
      )}
    </div>
  )
}
