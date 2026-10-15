'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Building2, CalendarDays, ChevronDown, ChevronRight, MapPin, Plus } from 'lucide-react'
import { useParams } from 'next/navigation'
import {
  deleteJob,
  listEventJobs,
  listEventsWithExhibitors,
  type LocalEvent,
  type LocalJob,
  type LocalJobDocument,
} from '@/lib/data-client'
import {
  internationalJobJenisLabels,
  type BcDocumentKind,
  type InternationalJobJenis,
} from '@/domain/job/types'
import { buildJobNomor } from '@/lib/job-number'
import { finishLoadingAfterMinimum, PageSkeleton } from '@/components/loading-skeletons'
import { ContextTicketList } from '@/components/context-ticket-list'
import { JobInitModal } from '@/components/job-init-modal'
import {
  JobDocumentEditorDialog,
  type EditableJobDocument,
} from '@/components/job-document-editor-dialog'
import {
  JobRow,
  applyUploadedDocument,
  downloadCustomsWorkbook,
  label,
  type JobDocumentExtraction,
} from '@/components/job-row'

function formatDateRange(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `${formatter.format(new Date(startsAt))} - ${formatter.format(new Date(endsAt))}`
}

type JobJenisGroup = InternationalJobJenis | 'LOCAL' | 'LEGACY'

/** Urutan dasar grup jenis; dipakai sebagai tie-break saat jumlah job sama. */
const jobJenisOrder: ReadonlyArray<JobJenisGroup> = [
  'VENUE',
  'ROAD_SHIPMENT',
  'PERMANENT_IMPORT',
  'ATA_CARNET',
  'TEMPORARY_EXPORT',
  'LOCAL',
  'LEGACY',
]

function jobJenisKey(job: LocalJob): JobJenisGroup {
  if (job.kind === 'LOCAL') return 'LOCAL'
  if (job.internationalJenis) return job.internationalJenis
  return 'LEGACY'
}

function jobJenisLabel(key: JobJenisGroup) {
  if (key === 'LOCAL') return 'Local'
  if (key === 'LEGACY') return 'Job lama'
  return internationalJobJenisLabels[key]
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<LocalEvent | null>(null)
  const [jobs, setJobs] = useState<LocalJob[]>([])
  const [loading, setLoading] = useState(true)
  const loadingStartedAt = useRef(Date.now())
  const [showNewJob, setShowNewJob] = useState(false)
  const [editingDocument, setEditingDocument] = useState<{
    job: LocalJob
    kind: EditableJobDocument
  } | null>(null)
  const [openJenis, setOpenJenis] = useState<Record<string, boolean>>({})
  const [deletingJob, setDeletingJob] = useState<LocalJob | null>(null)
  const [deleting, setDeleting] = useState(false)

  const nomorByJobId = useMemo(() => buildJobNomor(jobs), [jobs])

  const jenisGroups = useMemo(() => {
    const byKey = new Map<JobJenisGroup, LocalJob[]>()
    for (const job of jobs) {
      const key = jobJenisKey(job)
      const bucket = byKey.get(key)
      if (bucket) bucket.push(job)
      else byKey.set(key, [job])
    }
    return jobJenisOrder
      .flatMap((key) => {
        const groupJobs = byKey.get(key)
        return groupJobs ? [{ key, jobs: groupJobs }] : []
      })
      .sort((a, b) => b.jobs.length - a.jobs.length)
  }, [jobs])

  const loadData = useCallback(() => {
    loadingStartedAt.current = Date.now()
    setLoading(true)
    Promise.all([listEventsWithExhibitors(), listEventJobs(params.id)]).then(
      ([{ events }, eventJobs]) => {
        setEvent(events.find((item) => item.id === params.id) ?? null)
        setJobs(eventJobs)
        finishLoadingAfterMinimum(loadingStartedAt.current, () => setLoading(false))
      },
    )
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const showToast = (message: string, tone: 'info' | 'error' = 'info') => {
    window.dispatchEvent(
      new CustomEvent('vss:toast', {
        detail: { message, tone: tone === 'error' ? 'error' : 'success' },
      }),
    )
  }
  const handleDocumentSaved = (updated: LocalJob) => {
    setJobs((current) => current.map((job) => (job.id === updated.id ? updated : job)))
  }
  const handleDocumentUploaded = (
    jobId: string,
    document: LocalJobDocument,
    extraction?: JobDocumentExtraction,
  ) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId ? applyUploadedDocument(job, document, extraction) : job,
      ),
    )
  }
  async function generateCustomsWorkbook(job: LocalJob, documentType: BcDocumentKind) {
    try {
      await downloadCustomsWorkbook(job, documentType)
      showToast(`${label(documentType)} berhasil diunduh.`)
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'File BC tidak dapat dibuat.', 'error')
    }
  }
  async function handleDeleteJob() {
    if (!deletingJob) return
    setDeleting(true)
    try {
      await deleteJob(deletingJob.id)
      showToast(`${deletingJob.jobNumber} dihapus.`)
      setDeletingJob(null)
      loadData()
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Job tidak dapat dihapus.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <PageSkeleton cards={2} rows={5} />
  }

  if (!event) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold">Event tidak ditemukan</h1>
        <p className="mt-2 text-sm text-slate-500">Event ini tidak tersedia di perangkat ini.</p>
        <Link href="/events" className="btn-primary mt-6">
          Kembali ke events
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{event.officialName}</h1>
          {event.alias && <p className="mt-2 text-sm text-slate-500">{event.alias}</p>}
        </div>
      </div>

      <section className="card p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Informasi event</h2>
        <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 shrink-0 text-orange-600" size={18} />
            <div>
              <dt className="text-slate-500">Tanggal event</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {formatDateRange(event.startsAt, event.endsAt)}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 shrink-0 text-blue-600" size={18} />
            <div>
              <dt className="text-slate-500">Venue</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {event.venue?.officialName || 'Venue belum diinput'}
              </dd>
              {event.venue?.address && <p className="mt-1 text-slate-500">{event.venue.address}</p>}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 shrink-0 text-emerald-600" size={18} />
            <div>
              <dt className="text-slate-500">Event organizer</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {event.eventOrganizer?.legalName || 'Belum diinput'}
              </dd>
            </div>
          </div>
        </dl>
        {event.status === 'CANCELLED' && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <p className="font-semibold">Event dibatalkan</p>
            <p className="mt-1">Alasan: {event.cancellationReason}</p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{jobs.length} Jobs</h2>
          </div>
          {event.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => setShowNewJob(true)}
              className="btn-primary shrink-0"
            >
              <Plus size={16} /> New Job
            </button>
          )}
        </div>
        {jobs.length ? (
          <div className="space-y-4">
            {jenisGroups.map((group) => {
              const isOpen = openJenis[group.key] ?? false
              return (
                <section
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-black/10"
                >
                  <button
                    type="button"
                    onClick={() => setOpenJenis((value) => ({ ...value, [group.key]: !isOpen }))}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 bg-slate-50 px-5 py-4 text-left hover:text-orange-700"
                  >
                    <span className="text-slate-400">
                      {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">
                      {jobJenisLabel(group.key)}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {group.jobs.length} Job
                    </span>
                  </button>
                  {isOpen && (
                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full table-fixed text-left text-sm">
                        <colgroup>
                          <col className="w-[115px]" />
                          <col className="w-[145px]" />
                          <col className="w-[190px]" />
                          <col className="w-[135px]" />
                          <col className="w-[210px]" />
                          <col className="w-[60px]" />
                        </colgroup>
                        <thead className="border-b bg-white text-slate-900 font-semibold uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-3">No Job</th>
                            <th className="px-3 py-3">Exhibitor</th>
                            <th className="px-3 py-3">Dokumen shipment</th>
                            <th className="px-3 py-3">ETA</th>
                            <th className="px-3 py-3">Dokumen BC</th>
                            <th className="px-3 py-3">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.jobs.map((job) => (
                            <JobRow
                              key={job.id}
                              job={job}
                              nomor={nomorByJobId.get(job.id)}
                              actions={{
                                onEdit: (editedJob) => router.push(`/jobs/${editedJob.id}/edit`),
                                onDelete: (deletedJob) => setDeletingJob(deletedJob),
                              }}
                              onDocumentUploaded={handleDocumentUploaded}
                              onToast={showToast}
                              onGenerate={generateCustomsWorkbook}
                              onEditDocument={(selectedJob, kind) =>
                                setEditingDocument({ job: selectedJob, kind })
                              }
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-slate-500">
            Belum ada job untuk event ini.
          </p>
        )}
      </section>
      {/* <ContextTicketList contextKind="EVENT" contextId={event.id} /> */}
      <JobDocumentEditorDialog
        job={editingDocument?.job ?? null}
        kind={editingDocument?.kind ?? 'INVOICE'}
        open={Boolean(editingDocument)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingDocument(null)
        }}
        onSaved={handleDocumentSaved}
        onToast={showToast}
      />
      {deletingJob && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(mouseEvent) => {
            if (!deleting && mouseEvent.target === mouseEvent.currentTarget) setDeletingJob(null)
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-job-title"
            className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h2 id="delete-job-title" className="text-lg font-bold">
                  Hapus job?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  <span className="font-semibold">{deletingJob.jobNumber}</span> beserta dokumen
                  shipment, stage, shipment, customs job, dan ticket yang terikat padanya akan
                  dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingJob(null)}
                disabled={deleting}
                className="btn-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteJob}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? 'Menghapus...' : 'Hapus permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showNewJob && (
        <JobInitModal
          event={event}
          onCreated={() => {
            setShowNewJob(false)
            loadData()
          }}
          onCancel={() => setShowNewJob(false)}
        />
      )}
    </div>
  )
}
