'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'

import { listEvents, listJobs, type BcDocumentKind, type Job, type LocalEvent } from '@/lib/data-client'
import { internationalJobJenisLabels, internationalJobJenisValues } from '@/domain/job/types'
import {
  emptyJobTableFilters,
  filterJobs,
  sortJobsForTable,
  type JobListEvent,
  type JobTableFilters,
} from '@/lib/job-list'
import { Button } from '@/components/ui/button'
import { NewJobDialog } from '@/components/new-job-dialog'
import { JobCreateWizard } from '@/components/job-create-wizard'
import { PageSkeleton } from '@/components/loading-skeletons'
import { downloadCustomsWorkbook, label } from '@/components/job-row'
import { JobTable } from '@/components/job-table'

type JobSegment = 'EVENT' | 'GENERAL_CARGO' | 'PROJECT'

const segmentLabels: Record<JobSegment, string> = {
  EVENT: 'Event',
  GENERAL_CARGO: 'General Cargo',
  PROJECT: 'Project',
}

const selectClass = 'input m-0 max-w-48 py-2 text-sm shadow-none focus-visible:outline-none'

function toListEvent(event: LocalEvent): JobListEvent {
  return {
    id: event.id,
    name: event.officialName,
    venueName: event.venue?.name ?? null,
    startsOn: event.startsOn && event.startsOn !== 'null' ? event.startsOn : null,
    endsOn: event.endsOn && event.endsOn !== 'null' ? event.endsOn : null,
  }
}

/**
 * Daftar job lintas event dalam satu tabel. No Job menjadi kolom pertama; pencarian lewat filter.
 * Bentuk inward manifest klien tersedia sebagai export Excel di halaman event.
 */
export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [segment, setSegment] = useState<JobSegment>('EVENT')
  const [filters, setFilters] = useState<JobTableFilters>(emptyJobTableFilters)
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
    () => sortJobsForTable(filterJobs(jobs, filters, eventById), eventById),
    [jobs, filters, eventById],
  )
  const eventOptions = useMemo(
    () =>
      [...eventById.values()]
        .filter((event) => jobs.some((job) => job.eventId === event.id))
        .sort((left, right) => (right.startsOn ?? '').localeCompare(left.startsOn ?? '')),
    [eventById, jobs],
  )
  const setFilter = <K extends keyof JobTableFilters>(key: K, value: JobTableFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }))
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(emptyJobTableFilters)

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
      <section aria-label="Kategori job">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm font-medium">
          {(Object.keys(segmentLabels) as JobSegment[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSegment(value)}
              aria-pressed={segment === value}
              className={`rounded-md px-3 py-1.5 transition-colors ${segment === value ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-500 hover:bg-orange-50 hover:text-orange-700'}`}
            >
              {segmentLabels[value]}
            </button>
          ))}
        </div>
      </section>

      {segment === 'EVENT' ? (
        <>
          <section aria-label="Filter job">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative w-full lg:w-80 lg:flex-none">
                <span className="sr-only">Cari job</span>
                <Search className="absolute left-3 top-2.5 text-orange-500" size={18} aria-hidden="true" />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(event) => setFilter('search', event.target.value)}
                  className="input m-0 pl-10 shadow-none focus-visible:outline-none"
                  placeholder="Cari No Job, VSS, B/L, invoice, pihak"
                />
              </label>
              <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 px-0 py-2">
                <legend className="sr-only">Filter event aktif</legend>
                {([
                  [true, 'Event aktif'],
                  [false, 'Semua'],
                ] as const).map(([value, text]) => (
                  <label key={text} className="flex items-center gap-2 text-sm text-slate-500">
                    <input
                      type="radio"
                      name="job-active"
                      checked={filters.activeOnly === value}
                      onChange={() => setFilter('activeOnly', value)}
                      className="h-4 w-4 accent-orange-600"
                    />
                    {text}
                  </label>
                ))}
              </fieldset>
              <select
                className={selectClass}
                value={filters.eventId}
                onChange={(event) => setFilter('eventId', event.target.value)}
                aria-label="Filter event"
              >
                <option value="">Semua event</option>
                {eventOptions.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={filters.jenis}
                onChange={(event) => setFilter('jenis', event.target.value as JobTableFilters['jenis'])}
                aria-label="Filter jenis job"
              >
                <option value="">Semua jenis</option>
                {internationalJobJenisValues.map((jenis) => (
                  <option key={jenis} value={jenis}>
                    {internationalJobJenisLabels[jenis]}
                  </option>
                ))}
                <option value="LOCAL">Local</option>
              </select>
              <Button type="button" onClick={() => setShowNewJob(true)} className="lg:ml-auto">
                <Plus data-icon="inline-start" />
                Job baru
              </Button>
            </div>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => setFilters(emptyJobTableFilters)}
                className="mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800"
              >
                Reset filter
              </button>
            ) : null}
          </section>

          {rows.length ? (
            <JobTable
              jobs={rows}
              eventById={eventById}
              onGenerate={generateCustomsWorkbook}
            />
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
        </>
      ) : (
        <section className="card p-12 text-center">
          <p className="font-semibold text-slate-800">Belum ada job {segmentLabels[segment]}</p>
          <p className="mt-2 text-sm text-slate-500">
            Modul {segmentLabels[segment]} menyusul — saat ini job dikelola per event.
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
