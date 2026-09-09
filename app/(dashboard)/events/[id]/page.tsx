'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Globe2,
  LoaderCircle,
  MapPin,
  FileStack,
  Pencil,
  Plus,
  Users,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import {
  cancelEvent,
  listCipls,
  listEventExhibitors,
  listEventJobs,
  listEvents,
  type LocalEvent,
  type LocalExhibitor,
  type LocalJob,
} from '@/lib/data-client'

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
  const [event, setEvent] = useState<LocalEvent | null>(null)
  const [exhibitors, setExhibitors] = useState<LocalExhibitor[]>([])
  const [jobs, setJobs] = useState<LocalJob[]>([])
  const [ciplCounts, setCiplCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    Promise.all([listEvents(), listEventExhibitors(params.id), listEventJobs(params.id)]).then(
      ([events, eventExhibitors, eventJobs]) => {
        setEvent(events.find((item) => item.id === params.id) ?? null)
        setExhibitors(eventExhibitors)
        setJobs(eventJobs)
        Promise.all(eventExhibitors.map(async (exhibitor) => [exhibitor.id, (await listCipls(exhibitor.id)).length] as const))
          .then((counts) => setCiplCounts(Object.fromEntries(counts)))
        setLoading(false)
      },
    )
  }, [params.id])

  async function handleCancel() {
    if (!event) return
    if (!cancellationReason.trim()) {
      setCancelError('Alasan pembatalan wajib diisi.')
      return
    }
    setCancelling(true)
    setCancelError('')
    try {
      setEvent(await cancelEvent(event.id, cancellationReason))
      setShowCancelDialog(false)
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Event tidak dapat dibatalkan.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <LoaderCircle className="mr-2 animate-spin" size={18} /> Memuat event...
      </div>
    )
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{event.officialName}</h1>
          {event.alias && <p className="mt-2 text-sm text-slate-500">{event.alias}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/kanban?event=${event.id}&new=1`} className="btn-secondary shrink-0">
            <Plus size={16} /> <span className="ml-2">Tambah ticket</span>
          </Link>
          <Link href={`/events/${event.id}/edit`} className="btn-primary shrink-0">
            <Pencil size={16} /> <span className="ml-2">Edit</span>
          </Link>
          {event.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => setShowCancelDialog(true)}
              className="btn-secondary shrink-0 text-rose-700 hover:border-rose-200 hover:bg-rose-50"
            >
              Cancel event
            </button>
          )}
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

      <section className="card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">List of exhibitor</h2>
            <p className="mt-1 text-sm text-slate-500">
              Perusahaan yang berpartisipasi dalam event ini.
            </p>
          </div>
          <Users className="shrink-0 text-orange-600" size={22} />
        </div>
        {exhibitors.length ? (
          <div className="mt-5 divide-y divide-black/10 rounded-xl border border-black/10">
            {exhibitors.map((exhibitor) => (
              <div
                key={exhibitor.id}
                className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold text-slate-900">{exhibitor.legalName}</p>
                  {exhibitor.aliasName && (
                    <p className="mt-1 text-sm text-slate-500">{exhibitor.aliasName}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    {[exhibitor.email, exhibitor.phone, exhibitor.countryCode]
                      .filter(Boolean)
                      .join(' · ') || 'Kontak belum diinput'}
                  </p>
                  {jobs.filter((job) => job.exhibitorId === exhibitor.id).length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {jobs
                        .filter((job) => job.exhibitorId === exhibitor.id)
                        .map((job) => (
                          <Link key={job.id} href={`/jobs/${job.id}`} className="block text-xs text-slate-600 hover:text-orange-700">
                            <span className="font-semibold text-slate-800">{job.jobNumber}</span>
                            {' · '}
                            {job.awbNumber || job.blNumber || 'Dokumen belum diberi nomor'}
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    <Globe2 size={13} /> {exhibitor.type === 'LOCAL' ? 'Local' : 'International'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500"><FileStack size={13} /> {ciplCounts[exhibitor.id] ?? 0} CIPL</span>
                  {jobs.find((job) => job.exhibitorId === exhibitor.id) && (
                    <Link href={`/jobs/${jobs.find((job) => job.exhibitorId === exhibitor.id)!.id}`} className="btn-secondary px-3 py-1.5 text-xs">Buka Job</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-slate-500">
            Belum ada exhibitor yang ditambahkan.
          </p>
        )}
      </section>
      {showCancelDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.target === mouseEvent.currentTarget) setShowCancelDialog(false)
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-event-title"
            className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h2 id="cancel-event-title" className="text-lg font-bold">
                  Batalkan event?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Event akan tetap tersimpan sebagai rekam operasional. Masukkan alasan pembatalan.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelDialog(false)}
                className="btn-secondary"
              >
                Batal
              </button>
              <button type="button" onClick={handleCancel} disabled={cancelling} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {cancelling ? 'Membatalkan...' : 'Batalkan event'}
              </button>
            </div>
            <label className="label mt-5">
              Alasan pembatalan
              <textarea value={cancellationReason} onChange={(input) => setCancellationReason(input.target.value)} required className="input mt-1 min-h-24" />
            </label>
            {cancelError && <p className="mt-3 text-sm text-rose-700">{cancelError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
