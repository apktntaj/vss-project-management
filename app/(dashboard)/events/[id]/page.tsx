'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Building2, CalendarDays, ChevronDown, ChevronRight, FileSpreadsheet, MapPin, Plus } from 'lucide-react'
import { useParams } from 'next/navigation'
import {
  deleteJob,
  downloadEventManifest,
  listEventJobs,
  listEventsWithExhibitors,
  type LocalEvent,
  type Job,
} from '@/lib/data-client'
import { type BcDocumentKind } from '@/domain/job/types'
import { groupJobsByJenis, jobJenisLabel } from '@/lib/job-jenis'
import { buildJobNomor } from '@/lib/job-number'
import { PageSkeleton } from '@/components/loading-skeletons'
import { ContextTicketList } from '@/components/context-ticket-list'
import { EventAccessCard } from '@/components/event-access-card'
import { useCanSeeBilling } from '@/lib/use-billing-access'
import { JobCreateWizard } from '@/components/job-create-wizard'
import {
  JobDocumentEditorDialog,
  type EditableJobDocument,
} from '@/components/job-document-editor-dialog'
import { JobRow, downloadCustomsWorkbook, label } from '@/components/job-row'

function formatDateRange(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `${formatter.format(new Date(startsAt))} - ${formatter.format(new Date(endsAt))}`
}


export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<LocalEvent | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewJob, setShowNewJob] = useState(false)
  const [editingDocument, setEditingDocument] = useState<{
    job: Job
    kind: EditableJobDocument
  } | null>(null)
  const [openJenis, setOpenJenis] = useState<Record<string, boolean>>({})
  const [deletingJob, setDeletingJob] = useState<Job | null>(null)
  const [deleting, setDeleting] = useState(false)
  const canSeeBilling = useCanSeeBilling()

  const nomorByJobId = useMemo(() => buildJobNomor(jobs), [jobs])

  const jenisGroups = useMemo(() => groupJobsByJenis(jobs), [jobs])

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([listEventsWithExhibitors(), listEventJobs(params.id)]).then(
      ([{ events }, eventJobs]) => {
        setEvent(events.find((item) => item.id === params.id) ?? null)
        setJobs(eventJobs)
        setLoading(false)
      },
    )
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Routing "Job baru" dari halaman /jobs: ?newJob=1 langsung membuka form inisiasi job.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('newJob') === '1') setShowNewJob(true)
  }, [])

  const showToast = (message: string, tone: 'info' | 'error' = 'info') => {
    window.dispatchEvent(
      new CustomEvent('vss:toast', {
        detail: { message, tone: tone === 'error' ? 'error' : 'success' },
      }),
    )
  }
  // Ganti job di daftar dengan versi terbaru dari server (sesudah unggah/edit dokumen).
  const handleJobUpdated = (updated: Job) => {
    setJobs((current) => current.map((job) => (job.id === updated.id ? updated : job)))
  }
  async function generateCustomsWorkbook(job: Job, documentType: BcDocumentKind) {
    try {
      await downloadCustomsWorkbook(job, documentType)
      showToast(`${label(documentType)} berhasil diunduh.`)
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'File BC tidak dapat dibuat.', 'error')
    }
  }
  const [exporting, setExporting] = useState(false)
  async function exportManifest() {
    setExporting(true)
    try {
      const { blob, filename } = await downloadEventManifest(params.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
      showToast('Manifest berhasil diekspor.')
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Manifest tidak dapat diekspor.', 'error')
    } finally {
      setExporting(false)
    }
  }
  async function handleDeleteJob() {
    if (!deletingJob) return
    setDeleting(true)
    try {
      await deleteJob(deletingJob.id)
      showToast(`${deletingJob.jobNumber || 'Job'} dihapus.`)
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

      <EventAccessCard event={event} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{jobs.length} Jobs</h2>
          </div>
          <button
            type="button"
            onClick={exportManifest}
            disabled={exporting}
            className="btn-secondary ml-auto shrink-0"
            title="Unduh inward manifest event ini (Excel, format dokumen klien)"
          >
            <FileSpreadsheet size={16} /> {exporting ? 'Mengekspor…' : 'Export manifest (Excel)'}
          </button>
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
                      <table className="min-w-[1200px] w-full table-fixed text-left text-sm">
                        <colgroup>
                          <col className="w-[110px]" />
                          <col className="w-[145px]" />
                          <col className="w-[185px]" />
                          <col className="w-[110px]" />
                          {canSeeBilling && <col className="w-[95px]" />}
                          {canSeeBilling && <col className="w-[90px]" />}
                          <col className="w-[140px]" />
                          <col className="w-[200px]" />
                          <col className="w-[60px]" />
                        </colgroup>
                        <thead className="border-b bg-white text-slate-900 font-semibold uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-3">No Job</th>
                            <th className="px-3 py-3">Pihak</th>
                            <th className="px-3 py-3">Dokumen shipment</th>
                            <th className="px-3 py-3">ETA</th>
                            {canSeeBilling && <th className="px-3 py-3">Tagihan</th>}
                            {canSeeBilling && <th className="px-3 py-3">Status tagihan</th>}
                            <th className="px-3 py-3">Remark</th>
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
                              onJobUpdated={handleJobUpdated}
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
        onSaved={handleJobUpdated}
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
        <JobCreateWizard
          events={[event]}
          presetEvent={event}
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
