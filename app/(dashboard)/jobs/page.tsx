'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search } from 'lucide-react'

import { listEvents, listJobs, type BcDocumentKind, type Job, type LocalEvent } from '@/lib/data-client'
import {
  internationalJobJenisLabels,
  internationalJobJenisValues,
  invoiceStatusLabels,
  invoiceStatuses,
  jobStatuses,
  transportModeLabels,
  transportModes,
} from '@/domain/job/types'
import {
  emptyJobTableFilters,
  filterJobs,
  sortJobsForTable,
  type JobListEvent,
  type JobTableFilters,
} from '@/lib/job-list'
import {
  JobDocumentEditorDialog,
  type EditableJobDocument,
} from '@/components/job-document-editor-dialog'
import { Button } from '@/components/ui/button'
import { NewJobDialog } from '@/components/new-job-dialog'
import { JobCreateWizard } from '@/components/job-create-wizard'
import { PageSkeleton } from '@/components/loading-skeletons'
import { JobRow, downloadCustomsWorkbook, label } from '@/components/job-row'

type JobSegment = 'EVENT' | 'GENERAL_CARGO' | 'PROJECT'

const segmentLabels: Record<JobSegment, string> = {
  EVENT: 'Event',
  GENERAL_CARGO: 'General Cargo',
  PROJECT: 'Project',
}

const jobStatusLabels: Record<(typeof jobStatuses)[number], string> = {
  DRAFT: 'Draf',
  IN_PROGRESS: 'Diproses',
  ON_HOLD: 'Ditahan',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
}

const selectClass = 'input m-0 w-auto min-w-[150px] bg-slate-50 py-2 text-sm'

function toListEvent(event: LocalEvent): JobListEvent {
  return {
    id: event.id,
    name: event.officialName,
    startsOn: event.startsOn && event.startsOn !== 'null' ? event.startsOn : null,
    endsOn: event.endsOn && event.endsOn !== 'null' ? event.endsOn : null,
  }
}

/**
 * Daftar job lintas event dalam satu tabel. No Job menjadi kolom pertama; pencarian lewat filter.
 * Bentuk inward manifest klien tersedia sebagai export Excel di halaman event.
 */
export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [segment, setSegment] = useState<JobSegment>('EVENT')
  const [filters, setFilters] = useState<JobTableFilters>(emptyJobTableFilters)
  const [showNewJob, setShowNewJob] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<{
    job: Job
    kind: EditableJobDocument
  } | null>(null)
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
  // Ganti job di daftar dengan versi terbaru dari server (sesudah unggah/edit dokumen).
  const handleJobUpdated = (updated: Job) =>
    setJobs((current) => current.map((job) => (job.id === updated.id ? updated : job)))
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
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {(Object.keys(segmentLabels) as JobSegment[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSegment(value)}
              aria-pressed={segment === value}
              className={`rounded-md px-3 py-1.5 ${segment === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {segmentLabels[value]}
            </button>
          ))}
        </div>
      </section>

      {segment === 'EVENT' ? (
        <>
          <section aria-label="Filter job" className="space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative w-full lg:w-96 lg:flex-none">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input
                  value={filters.search}
                  onChange={(event) => setFilter('search', event.target.value)}
                  className="input m-0 border-0 bg-slate-50 pl-10 shadow-none"
                  placeholder="Cari No Job, VSS, B/L/AWB, invoice, pihak, exhibitor"
                  aria-label="Cari job"
                />
              </label>
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setFilter('activeOnly', true)}
                  className={`rounded-md px-3 py-1.5 ${filters.activeOnly ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  Event aktif
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('activeOnly', false)}
                  className={`rounded-md px-3 py-1.5 ${!filters.activeOnly ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  Semua
                </button>
              </div>
              <Button type="button" onClick={() => setShowNewJob(true)} className="lg:ml-auto">
                <Plus data-icon="inline-start" />
                Job baru
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              <select
                className={selectClass}
                value={filters.transportMode}
                onChange={(event) =>
                  setFilter('transportMode', event.target.value as JobTableFilters['transportMode'])
                }
                aria-label="Filter jalur"
              >
                <option value="">Semua jalur</option>
                {transportModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {transportModeLabels[mode]}
                  </option>
                ))}
              </select>
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
                value={filters.invoiceStatus}
                onChange={(event) =>
                  setFilter('invoiceStatus', event.target.value as JobTableFilters['invoiceStatus'])
                }
                aria-label="Filter status tagihan"
              >
                <option value="">Semua tagihan</option>
                {invoiceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {invoiceStatusLabels[status]}
                  </option>
                ))}
              </select>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => setFilters(emptyJobTableFilters)}
                  className="px-2 text-sm font-semibold text-orange-700 hover:text-orange-800"
                >
                  Reset filter
                </button>
              )}
              <span className="ml-auto text-sm text-slate-500">{rows.length} job</span>
            </div>
          </section>

          {rows.length ? (
            <section className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1380px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[120px]" />
                    <col className="w-[170px]" />
                    <col className="w-[145px]" />
                    <col className="w-[185px]" />
                    <col className="w-[110px]" />
                    <col className="w-[95px]" />
                    <col className="w-[90px]" />
                    <col className="w-[140px]" />
                    <col className="w-[200px]" />
                    <col className="w-[40px]" />
                  </colgroup>
                  <thead className="border-b bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-3 py-3">No Job</th>
                      <th className="px-3 py-3">Event · Jenis</th>
                      <th className="px-3 py-3">Pihak</th>
                      <th className="px-3 py-3">Dokumen shipment</th>
                      <th className="px-3 py-3">ETA</th>
                      <th className="px-3 py-3">Tagihan</th>
                      <th className="px-3 py-3">Status tagihan</th>
                      <th className="px-3 py-3">Remark</th>
                      <th className="px-3 py-3">Dokumen BC</th>
                      <th className="px-3 py-3">
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        nomor={job.jobNumber ?? undefined}
                        event={eventById.get(job.eventId) ?? null}
                        onJobUpdated={handleJobUpdated}
                        onToast={showToast}
                        onGenerate={generateCustomsWorkbook}
                        onEditDocument={(selectedJob, kind) => setEditingDocument({ job: selectedJob, kind })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
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
          onCreated={() => {
            setWizardOpen(false)
            load(true)
          }}
          onCancel={() => setWizardOpen(false)}
        />
      )}
      <JobDocumentEditorDialog
        job={editingDocument?.job ?? null}
        kind={editingDocument?.kind ?? 'INVOICE'}
        open={Boolean(editingDocument)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingDocument(null)
        }}
        onSaved={handleJobUpdated}
        onToast={showToast}
      />
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
