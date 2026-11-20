'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
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
import { sortJobsForTable } from '@/lib/job-list'
import { withStageGoods } from '@/domain/job/stages'
import { buildExhibitorGroups, type ExhibitorGroupBy } from '@/lib/exhibitor-view'
import { PageSkeleton } from '@/components/loading-skeletons'
import { EventAccessCard } from '@/components/event-access-card'
import { GuardedButton } from '@/components/guarded-button'
import { useWriteAccess } from '@/lib/use-write-access'
import {
  canManageEventAccess,
  creatableJenis,
  jobCreateDenialReason,
  jobPermissions,
} from '@/lib/write-access'
import { toast } from '@/components/toast'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContextTicketList } from '@/components/context-ticket-list'
import { JobCreateWizard } from '@/components/job-create-wizard'
import { JobRow } from '@/components/job-row'
import { EventExhibitorView } from '@/components/event-exhibitor-view'
import { CancelJobDialog } from '@/components/cancel-job-dialog'
import { KanwilLetterDialog, type KanwilLetterFormInput } from '@/components/kanwil-letter-dialog'
import { jobLabel } from '@/domain/job/numbering'
import {
  displayStatusBadgeClass,
  displayStatusLabel,
  formatDateRange as formatEventRange,
  lifecycleBadge,
} from '@/features/events/components/event-presentation'
import type { EventDisplayStatus } from '@/domain/event/types'
import { wibDateOf } from '@/lib/wib-date'

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

// Display status turunan tanggal — aturan yang sama dengan daftar event (server), dihitung di klien
// karena halaman ini membaca event lewat data-client.
function deriveDisplayStatus(startsOn: string, endsOn: string, today: string): EventDisplayStatus {
  if (!startsOn || !endsOn) return 'unscheduled'
  if (today < startsOn) return 'soon'
  if (today > endsOn) return 'done'
  return 'ongoing'
}

const VIEW_TABS = [
  ['jenis', 'Job'],
  ['hall', 'Hall'],
  ['agent', 'Agent'],
] as const

const TABLE_HEAD =
  'whitespace-nowrap border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500'

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<LocalEvent | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [view, setView] = useState<'jenis' | ExhibitorGroupBy>('jenis')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showNewJob, setShowNewJob] = useState(false)
  const [openJenis, setOpenJenis] = useState<Record<string, boolean>>({})
  const [cancellingJob, setCancellingJob] = useState<Job | null>(null)
  const [letterJob, setLetterJob] = useState<Job | null>(null)
  const wa = useWriteAccess()

  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs])

  const jenisGroups = useMemo(() => groupJobsByJenis(jobs), [jobs])
  const exhibitorGroups = useMemo(
    () => (view === 'jenis' ? [] : buildExhibitorGroups(jobs, view)),
    [jobs, view],
  )

  const loadData = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    Promise.all([listEventsWithExhibitors(), listEventJobs(params.id)])
      .then(([{ events }, eventJobs]) => {
        setEvent(events.find((item) => item.id === params.id) ?? null)
        setJobs(eventJobs)
      })
      .catch((caught) => {
        setLoadError(caught instanceof Error ? caught.message : 'Data event tidak dapat dimuat.')
      })
      .finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Routing "Job baru" dari halaman /jobs: ?newJob=1 langsung membuka form inisiasi job.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('newJob') === '1') setShowNewJob(true)
  }, [])

  const showToast = (message: string, tone: 'info' | 'error' = 'info') =>
    toast(message, tone === 'error' ? 'error' : 'success')
  const [exporting, setExporting] = useState<'inward' | 'outward' | null>(null)
  async function exportManifest(direction: 'inward' | 'outward') {
    setExporting(direction)
    try {
      const { blob, filename } = await downloadEventManifest(params.id, direction)
      saveBlob(blob, filename)
      showToast(
        direction === 'inward'
          ? 'Inward manifest berhasil diekspor.'
          : 'Outward manifest berhasil diekspor.',
      )
    } catch (caught) {
      showToast(
        caught instanceof Error ? caught.message : 'Manifest tidak dapat diekspor.',
        'error',
      )
    } finally {
      setExporting(null)
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

  if (loadError) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center" role="alert">
        <AlertTriangle className="mx-auto text-rose-500" size={28} aria-hidden="true" />
        <h1 className="mt-3 text-xl font-bold">Data event gagal dimuat</h1>
        <p className="mt-2 text-sm text-slate-600">{loadError}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={loadData} className="btn-primary">
            Coba lagi
          </button>
          <Link href="/events" className="btn-secondary">
            Kembali ke events
          </Link>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold">Event tidak ditemukan</h1>
        <p className="mt-2 text-sm text-slate-600">
          Event ini tidak ada atau Anda tidak punya akses ke event tersebut.
        </p>
        <Link href="/events" className="btn-primary mt-6">
          Kembali ke events
        </Link>
      </div>
    )
  }

  const today = wibDateOf(new Date())
  const displayStatus = deriveDisplayStatus(event.startsOn, event.endsOn, today)
  const cancelled = lifecycleBadge(event.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE')
  const jenisBaru = creatableJenis(wa, event.id)
  const newJobDenial = jobCreateDenialReason(wa, [event.id])
  const canManageAccess = canManageEventAccess(wa, event.picId)

  return (
    <div className="-mt-3 space-y-4 lg:-mt-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{event.officialName}</h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${displayStatusBadgeClass(displayStatus, event.startsOn, today)}`}
            >
              {displayStatusLabel(displayStatus, event.startsOn, today)}
            </span>
            {cancelled ? (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cancelled.className}`}>
                {cancelled.label}
              </span>
            ) : null}
          </div>
          {event.picName && <p className="mt-1 text-sm text-slate-600">{event.picName}</p>}
          {event.alias && <p className="text-sm text-slate-600">{event.alias}</p>}
        </div>
        <Menu.Root>
          <Menu.Trigger
            disabled={exporting !== null}
            className="btn-secondary shrink-0 gap-2"
            title="Unduh manifest event ini (Excel)"
          >
            {exporting ? (
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            {exporting ? 'Mengekspor…' : 'Export manifest'}
            <ChevronDown size={14} aria-hidden="true" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner align="end" sideOffset={6} className="z-50">
              <Menu.Popup className="w-60 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg outline-none">
                <Menu.Item
                  onClick={() => void exportManifest('inward')}
                  className="cursor-default px-3 py-2 text-sm text-slate-800 outline-none data-[highlighted]:bg-slate-100"
                >
                  <span className="block font-medium">Inward manifest</span>
                  <span className="block text-xs text-slate-600">Format dokumen klien (Excel)</span>
                </Menu.Item>
                <Menu.Item
                  onClick={() => void exportManifest('outward')}
                  className="cursor-default px-3 py-2 text-sm text-slate-800 outline-none data-[highlighted]:bg-slate-100"
                >
                  <span className="block font-medium">Outward manifest</span>
                  <span className="block text-xs text-slate-600">Barang re-ekspor (Excel)</span>
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>

      <section className="card px-5 py-3.5">
        <h2 className="sr-only">Informasi event</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-3">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 shrink-0 text-blue-600" size={18} aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-slate-600">Tanggal event</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {formatEventRange(event.startsOn, event.endsOn)}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 shrink-0 text-emerald-600" size={18} aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-slate-600">Event organizer</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {event.eventOrganizer?.legalName || 'Belum diinput'}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 shrink-0 text-violet-600" size={18} aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-slate-600">Venue</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {event.venue?.officialName || 'Venue belum diinput'}
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
        <h2 className="text-lg font-semibold">Detail Jobs</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span id="job-view-label" className="text-sm font-medium text-slate-600">
              Grouped by
            </span>
            <Tabs
              value={view}
              onValueChange={(value) => setView(value as 'jenis' | ExhibitorGroupBy)}
            >
              <TabsList aria-labelledby="job-view-label" className="h-9">
                {VIEW_TABS.map(([value, text]) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="px-4 text-slate-600 hover:text-slate-900 data-[active]:bg-orange-600 data-[active]:font-semibold data-[active]:text-white data-[active]:shadow-sm data-[active]:hover:text-white"
                  >
                    {text}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          {event.status !== 'CANCELLED' && (
            <GuardedButton
              denial={newJobDenial}
              onClick={() => setShowNewJob(true)}
              className="btn-primary shrink-0"
            >
              <Plus size={16} aria-hidden="true" /> New Job
            </GuardedButton>
          )}
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
                    className="flex w-full items-center gap-3 bg-slate-50 px-5 py-3 text-left hover:bg-slate-100"
                  >
                    <span className="text-slate-600">
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
                          <col className="w-[200px]" />
                          <col className="w-[240px]" />
                          <col className="w-[180px]" />
                          <col className="w-[140px]" />
                          <col className="w-[100px]" />
                          <col className="w-[90px]" />
                          <col className="w-[60px]" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th className={TABLE_HEAD}>No Job</th>
                            <th className={TABLE_HEAD}>Agent</th>
                            <th className={TABLE_HEAD}>BL/AWB</th>
                            <th className={TABLE_HEAD}>ETA</th>
                            <th className={TABLE_HEAD}>Packages</th>
                            <th className={TABLE_HEAD}>CBM</th>
                            <th className={TABLE_HEAD}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortJobsForTable(group.jobs, new Map()).map((job) => (
                            <JobRow
                              key={job.id}
                              job={withStageGoods(
                                job,
                                job.sourceJobId ? jobsById.get(job.sourceJobId) : null,
                              )}
                              actions={{
                                onEdit: (editedJob) => router.push(`/jobs/${editedJob.id}`),
                                onCancel: (jobToCancel) => setCancellingJob(jobToCancel),
                                onKanwilLetter: setLetterJob,
                                onTppbGoodsForm: generateTppbGoodsForm,
                              }}
                              permissions={jobPermissions(wa, job)}
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
          <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-slate-600">
            Belum ada job untuk event ini.
          </p>
        )}
      </section>
      {canManageAccess && <EventAccessCard eventId={event.id} />}
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
      {showNewJob && newJobDenial === null && (
        <JobCreateWizard
          events={[event]}
          presetEvent={event}
          jenisFor={() => jenisBaru}
          onCreated={(job) => router.push(`/jobs/${job.id}`)}
          onCancel={() => setShowNewJob(false)}
        />
      )}
    </div>
  )
}
