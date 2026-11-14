'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Plus,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import {
  downloadEventManifest,
  downloadJobKanwilLetter,
  downloadJobTppbGoodsForm,
  listEventJobs,
  listEventsWithExhibitors,
  type LocalEvent,
  type Job,
} from '@/lib/data-client'
import { groupJobsByJenis, jobJenisLabel } from '@/lib/job-jenis'
import { buildExhibitorGroups, type ExhibitorGroupBy } from '@/lib/exhibitor-view'
import { buildJobNomor } from '@/lib/job-number'
import { PageSkeleton } from '@/components/loading-skeletons'
import { ContextTicketList } from '@/components/context-ticket-list'
import { JobCreateWizard } from '@/components/job-create-wizard'
import { JobRow } from '@/components/job-row'
import { EventExhibitorView } from '@/components/event-exhibitor-view'
import { CancelJobDialog } from '@/components/cancel-job-dialog'
import { KanwilLetterDialog, type KanwilLetterFormInput } from '@/components/kanwil-letter-dialog'
import { jobLabel } from '@/domain/job/numbering'

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

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
  const [view, setView] = useState<'jenis' | ExhibitorGroupBy>('jenis')
  const [loading, setLoading] = useState(true)
  const [showNewJob, setShowNewJob] = useState(false)
  const [openJenis, setOpenJenis] = useState<Record<string, boolean>>({})
  const [cancellingJob, setCancellingJob] = useState<Job | null>(null)
  const [letterJob, setLetterJob] = useState<Job | null>(null)

  const nomorByJobId = useMemo(() => buildJobNomor(jobs), [jobs])

  const jenisGroups = useMemo(() => groupJobsByJenis(jobs), [jobs])
  const exhibitorGroups = useMemo(
    () => (view === 'jenis' ? [] : buildExhibitorGroups(jobs, view)),
    [jobs, view],
  )

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
  const [exporting, setExporting] = useState(false)
  async function exportManifest() {
    setExporting(true)
    try {
      const { blob, filename } = await downloadEventManifest(params.id)
      saveBlob(blob, filename)
      showToast('Manifest berhasil diekspor.')
    } catch (caught) {
      showToast(
        caught instanceof Error ? caught.message : 'Manifest tidak dapat diekspor.',
        'error',
      )
    } finally {
      setExporting(false)
    }
  }

  async function generateKanwilLetter(input: KanwilLetterFormInput): Promise<boolean> {
    if (!letterJob) return false
    try {
      const { blob, filename } = await downloadJobKanwilLetter(letterJob.id, input)
      saveBlob(blob, filename)
      showToast('Surat permohonan Kanwil berhasil diunduh.')
      return true
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Surat Kanwil tidak dapat dibuat.', 'error')
      return false
    }
  }

  async function generateTppbGoodsForm(job: Job) {
    try {
      const { blob, filename } = await downloadJobTppbGoodsForm(job.id)
      saveBlob(blob, filename)
      showToast('Form rincian barang berhasil diunduh.')
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Form rincian barang tidak dapat dibuat.', 'error')
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
    <div className="-mt-3 space-y-4 lg:-mt-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{event.officialName}</h1>
          {event.alias && <p className="mt-1 text-sm text-slate-500">{event.alias}</p>}
        </div>
        <button
          type="button"
          onClick={exportManifest}
          disabled={exporting}
          className="btn-secondary shrink-0 gap-2"
          title="Unduh inward manifest event ini (Excel, format dokumen klien)"
        >
          {exporting ? (
            <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          ) : (
            <Download size={16} aria-hidden="true" />
          )}
          {exporting ? 'Mengekspor…' : 'Export Manifest'}
        </button>
      </div>

      <section className="card px-5 py-3.5">
        <h2 className="sr-only">Informasi event</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-3">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 shrink-0 text-orange-600" size={18} />
            <div>
              <dt className="text-slate-500">Tanggal event</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {formatDateRange(event.startsAt, event.endsAt)}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 shrink-0 text-blue-600" size={18} />
            <div>
              <dt className="text-slate-500">Venue</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {event.venue?.officialName || 'Venue belum diinput'}
              </dd>
              {event.venue?.address && (
                <p className="mt-0.5 text-slate-500">{event.venue.address}</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 shrink-0 text-emerald-600" size={18} />
            <div>
              <dt className="text-slate-500">Event organizer</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {event.eventOrganizer?.legalName || 'Belum diinput'}
              </dd>
            </div>
          </div>
        </dl>
        {event.status === 'CANCELLED' && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            <p className="font-semibold">Event dibatalkan</p>
            <p className="mt-1">Alasan: {event.cancellationReason}</p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Detail Jobs</h2>
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
        <div
          className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium"
          role="tablist"
          aria-label="Tampilan job"
        >
          {(
            [
              ['jenis', 'Grouped By Job'],
              ['hall', 'By Hall'],
              ['agent', 'By Agent'],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={`rounded-md px-3 py-1.5 ${view === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {text}
            </button>
          ))}
        </div>
        {view !== 'jenis' ? (
          // `key`: status buka/tutup grup tidak terbawa antar dimensi (key grup '' dipakai keduanya).
          <EventExhibitorView key={view} groups={exhibitorGroups} by={view} />
        ) : jobs.length ? (
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
                      <table className="min-w-[1030px] w-full table-fixed text-left text-sm">
                        <colgroup>
                          <col className="w-[140px]" />
                          <col className="w-[260px]" />
                          <col className="w-[200px]" />
                          <col className="w-[150px]" />
                          <col className="w-[110px]" />
                          <col className="w-[100px]" />
                          <col className="w-[70px]" />
                        </colgroup>
                        <thead className="whitespace-nowrap border-b bg-white text-slate-900 font-semibold uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-3">No Job</th>
                            <th className="px-3 py-3">Agent</th>
                            <th className="px-3 py-3">BL/AWB</th>
                            <th className="px-3 py-3">ETA</th>
                            <th className="px-3 py-3">Packages</th>
                            <th className="px-3 py-3">CBM</th>
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
                                onEdit: (editedJob) => router.push(`/jobs/${editedJob.id}`),
                                onCancel: (jobToCancel) => setCancellingJob(jobToCancel),
                                onKanwilLetter: setLetterJob,
                                onTppbGoodsForm: generateTppbGoodsForm,
                              }}
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
      {cancellingJob && (
        <CancelJobDialog
          job={cancellingJob}
          open
          onClose={() => setCancellingJob(null)}
          onCancelled={(cancelled) => {
            showToast(`${jobLabel(cancelled)} dibatalkan.`)
            setCancellingJob(null)
            loadData()
          }}
        />
      )}
      {letterJob && (
        <KanwilLetterDialog
          job={letterJob}
          onClose={() => setLetterJob(null)}
          onSubmit={generateKanwilLetter}
        />
      )}
      {showNewJob && (
        <JobCreateWizard
          events={[event]}
          presetEvent={event}
          onCreated={(job) => router.push(`/jobs/${job.id}`)}
          onCancel={() => setShowNewJob(false)}
        />
      )}
    </div>
  )
}
