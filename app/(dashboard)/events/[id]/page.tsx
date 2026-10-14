'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Briefcase, Building2, CalendarDays, MapPin, Plus } from 'lucide-react'
import { useParams } from 'next/navigation'
import {
  listAgents,
  listEventJobs,
  listEventsWithExhibitors,
  type InternationalJobJenis,
  type LocalEvent,
  type LocalExhibitor,
  type LocalJob,
  type Agent,
} from '@/lib/data-client'
import { finishLoadingAfterMinimum, PageSkeleton } from '@/components/loading-skeletons'
import { ContextTicketList } from '@/components/context-ticket-list'
import { EventJobsTable } from '@/components/event-jobs-table'
import { NewJobKindModal } from '@/components/new-job-kind-modal'
import { InternationalJobInitModal } from '@/components/international-job-init-modal'
import { jobKindLabels } from '@/domain/job/types'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
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
  const [event, setEvent] = useState<LocalEvent | null>(null)
  const [exhibitors, setExhibitors] = useState<LocalExhibitor[]>([])
  const [jobs, setJobs] = useState<LocalJob[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const loadingStartedAt = useRef(Date.now())
  const [showNewJob, setShowNewJob] = useState(false)
  const [initJenis, setInitJenis] = useState<InternationalJobJenis | null>(null)

  const loadData = useCallback(() => {
    loadingStartedAt.current = Date.now()
    setLoading(true)
    Promise.all([listEventsWithExhibitors(), listEventJobs(params.id), listAgents()]).then(
      ([{ events, exhibitorsByEvent }, eventJobs, loadedAgents]) => {
        setEvent(events.find((item) => item.id === params.id) ?? null)
        setExhibitors(exhibitorsByEvent[params.id] ?? [])
        setJobs(eventJobs)
        setAgents(loadedAgents)
        finishLoadingAfterMinimum(loadingStartedAt.current, () => setLoading(false))
      },
    )
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{event.officialName}</h1>
          {event.alias && <p className="mt-2 text-sm text-slate-500">{event.alias}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/kanban?new=1&contextKind=EVENT&contextId=${event.id}`} className="btn-secondary shrink-0">
            <Plus size={16} /> <span className="ml-2">Tambah ticket</span>
          </Link>
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Jobs ({jobs.length})</h2>
            <p className="mt-1 text-sm text-slate-500">
              Satu agent mewakili satu job dengan satu CIPL dan satu B/L.
            </p>
          </div>
          {event.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => setShowNewJob(true)}
              className="btn-primary shrink-0"
            >
              <Briefcase size={16} /> New Job
            </button>
          )}
        </div>
        <EventJobsTable jobs={jobs} agents={agents} exhibitors={exhibitors} />
      </section>
      <ContextTicketList contextKind="EVENT" contextId={event.id} />
      {showNewJob && (
        <NewJobKindModal
          event={event}
          onSelect={(kind, internationalJenis) => {
            setShowNewJob(false)
            if (kind === 'INTERNATIONAL' && internationalJenis) {
              setInitJenis(internationalJenis)
              return
            }
            toast(
              `Job ${jobKindLabels[kind]} dipilih. Form inisiasi job Local menyusul pada iterasi berikutnya.`,
              'success',
            )
          }}
          onCancel={() => setShowNewJob(false)}
        />
      )}
      {initJenis && (
        <InternationalJobInitModal
          event={event}
          jenis={initJenis}
          onCreated={() => {
            setInitJenis(null)
            loadData()
          }}
          onCancel={() => setInitJenis(null)}
        />
      )}
    </div>
  )
}
