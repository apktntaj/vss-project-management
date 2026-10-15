'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import {
  deleteEvent,
  listCipls,
  listCiplVersions,
  listEventsWithExhibitors,
  listJobs,
  type LocalEvent,
  type LocalExhibitor,
  type LocalJob,
} from '@/lib/data-client'
import type { Cipl, CiplVersion } from '@/domain/exhibition/types'
import { EventFormModal } from '@/components/event-form-modal'
import { JobInitModal } from '@/components/job-init-modal'
import { finishLoadingAfterMinimum, PageSkeleton } from '@/components/loading-skeletons'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

const DAY = 24 * 60 * 60 * 1000

function calendarDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function getEventTiming(startsAt: string, endsAt: string) {
  const today = new Date()
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const toDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const day = 24 * 60 * 60 * 1000
  const daysUntilStart = Math.ceil((toDay(start) - toDay(today)) / day)
  const daysUntilEnd = Math.ceil((toDay(end) - toDay(today)) / day)

  if (daysUntilStart > 0) return `Mulai ${daysUntilStart} hari lagi`
  if (daysUntilEnd > 0) return `Berakhir ${daysUntilEnd} hari lagi`
  if (daysUntilEnd === 0) return 'Berakhir hari ini'
  return 'Event sudah berakhir'
}

function isCancelled(event: LocalEvent) {
  return event.status === 'CANCELLED'
}

type EventStatus = 'soon' | 'ongoing' | 'done'
type EventFilter = EventStatus | 'active' | 'all'

function getEventStatus(startsAt: string, endsAt: string): EventStatus {
  const today = new Date()
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const toDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

  if (toDay(today) < toDay(start)) return 'soon'
  if (toDay(today) > toDay(end)) return 'done'
  return 'ongoing'
}

function formatEventDateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agt',
    'Sept',
    'Okt',
    'Nov',
    'Des',
  ]
  const fullDate = (date: Date) =>
    `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`

  if (sameMonth) {
    return `${start.getDate()} - ${fullDate(end)}`
  }

  return `${fullDate(start)} - ${fullDate(end)}`
}

function overlapsInCalendar(event: LocalEvent, other: LocalEvent) {
  return (
    calendarDay(new Date(event.startsAt)) <= calendarDay(new Date(other.endsAt)) &&
    calendarDay(new Date(other.startsAt)) <= calendarDay(new Date(event.endsAt))
  )
}

function overlapsThisWeek(event: LocalEvent, other: LocalEvent, today = new Date()) {
  const daysSinceMonday = (today.getDay() + 6) % 7
  const weekStartsAt = calendarDay(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday),
  )
  const weekEndsAt = weekStartsAt + 6 * DAY
  const overlapStartsAt = Math.max(
    calendarDay(new Date(event.startsAt)),
    calendarDay(new Date(other.startsAt)),
  )
  const overlapEndsAt = Math.min(
    calendarDay(new Date(event.endsAt)),
    calendarDay(new Date(other.endsAt)),
  )

  return (
    overlapStartsAt <= overlapEndsAt &&
    overlapEndsAt >= weekStartsAt &&
    overlapStartsAt <= weekEndsAt
  )
}

type CiplWithVersions = {
  cipl: Cipl
  versions: CiplVersion[]
}

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [exhibitorsByEvent, setExhibitorsByEvent] = useState<Record<string, LocalExhibitor[]>>({})
  const [jobs, setJobs] = useState<LocalJob[]>([])
  const [cipls, setCipls] = useState<CiplWithVersions[]>([])
  const [newJobForEvent, setNewJobForEvent] = useState<LocalEvent | null>(null)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [editingEvent, setEditingEvent] = useState<LocalEvent | null>(null)
  const [deletingEvent, setDeletingEvent] = useState<LocalEvent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [openMenuEventId, setOpenMenuEventId] = useState<string | null>(null)
  const [expandedExhibitorEventId, setExpandedExhibitorEventId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EventFilter>('active')
  const [loading, setLoading] = useState(true)
  const loadingStartedAt = useRef(Date.now())
  const initialLoadStarted = useRef(false)

  const reloadEvents = () => {
    loadingStartedAt.current = Date.now()
    setLoading(true)
    Promise.all([listEventsWithExhibitors(), listJobs()]).then(
      async ([{ events: loadedEvents, exhibitorsByEvent }, loadedJobs]) => {
        setEvents(loadedEvents)
        setExhibitorsByEvent(exhibitorsByEvent)
        setJobs(loadedJobs)
      const loadedCipls = await Promise.all(
        Object.values(exhibitorsByEvent)
          .flat()
          .map(async (exhibitor) => {
            const exhibitorCipls = await listCipls(exhibitor.id)
            return Promise.all(
              exhibitorCipls.map(async (cipl) => ({
                cipl,
                versions: await listCiplVersions(cipl.id),
              })),
            )
          }),
      )
      setCipls(loadedCipls.flat())
        finishLoadingAfterMinimum(loadingStartedAt.current, () => setLoading(false))
      },
    )
  }
  useEffect(() => {
    if (initialLoadStarted.current) return
    initialLoadStarted.current = true
    reloadEvents()
  }, [])

  const normalizedSearch = search.trim().toLowerCase()
  const filteredEvents = events.filter((event) => {
    const searchableText = [
      event.officialName,
      event.alias,
      event.venue?.officialName,
      event.venue?.aliasName,
      event.eventOrganizer?.legalName,
      event.picName,
      ...(exhibitorsByEvent[event.id] ?? []).flatMap((exhibitor) => [
        exhibitor.legalName,
        exhibitor.aliasName,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch)
    const eventStatus = getEventStatus(event.startsAt, event.endsAt)
    const matchesStatus =
      status === 'all' ||
      (status === 'active' && !isCancelled(event) && eventStatus !== 'done') ||
      eventStatus === status

    return matchesSearch && matchesStatus
  })

  const hasFilters = Boolean(search || status !== 'active')
  const activeEvents = events.filter((event) => !isCancelled(event))
  const ongoingEvents = activeEvents.filter(
    (event) => getEventStatus(event.startsAt, event.endsAt) === 'ongoing',
  )
  const cancelledEvents = events.filter(isCancelled)
  const operationalEvents = activeEvents.filter(
    (event) => getEventStatus(event.startsAt, event.endsAt) !== 'done',
  )
  const eventOverlapsThisWeek = operationalEvents.flatMap((event, index) =>
    operationalEvents
      .slice(index + 1)
      .filter((other) => overlapsInCalendar(event, other) && overlapsThisWeek(event, other))
      .map((other) => [event, other] as const),
  )
  const venueConflicts = eventOverlapsThisWeek.filter(
    ([event, other]) => event.venueId === other.venueId,
  )
  const exhibitors = Object.values(exhibitorsByEvent).flat()
  const ciplsNotReady = cipls.filter(
    ({ cipl }) => cipl.status !== 'READY' && cipl.status !== 'CANCELLED',
  )
  const ciplItemLoad = cipls.reduce((total, { cipl, versions }) => {
    const activeVersion = versions.find((version) => version.id === cipl.activeVersionId)
    return total + (activeVersion?.items.length ?? 0)
  }, 0)
  const clearFilters = () => {
    setSearch('')
    setStatus('active')
  }
  const jobsByEvent: Record<string, LocalJob[]> = {}
  for (const job of jobs) {
    if (!job.eventId) continue
    ;(jobsByEvent[job.eventId] ||= []).push(job)
  }

  async function handleDeleteEvent() {
    if (!deletingEvent) return
    setDeleting(true)
    try {
      await deleteEvent(deletingEvent.id)
      toast('Event dihapus permanen.', 'success')
      setDeletingEvent(null)
      reloadEvents()
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Event tidak dapat dihapus.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <PageSkeleton cards={3} rows={6} />

  return (
    <>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Events</h1>
            <p className="mt-2 text-sm text-slate-500">Pantau kesiapan dan jadwal pameran.</p>
          </div>
          <button type="button" onClick={() => setShowNewEvent(true)} className="btn-primary shrink-0">
            <Plus size={16} /> <span className="ml-2">New event</span>
          </button>
        </header>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="grid gap-4 sm:grid-cols-2 lg:col-span-2" aria-label="Summary">
            <article className="card p-5">
              <p className="text-sm text-slate-500">Total event</p>
              <p className="mt-2 text-3xl font-bold text-slate-700">{events.length}</p>
            </article>
            <article className="card p-5">
              <p className="text-sm text-slate-500">Berlangsung</p>
              <p className="mt-2 text-3xl font-bold text-emerald-700">{ongoingEvents.length}</p>
            </article>
            <article className="card p-5">
              <p className="text-sm text-slate-500">Exhibitor</p>
              <p className="mt-2 text-3xl font-bold text-blue-700">{exhibitors.length}</p>
            </article>
            <article className="card p-5">
              <p className="text-sm text-slate-500">Load item</p>
              <p className="mt-2 text-3xl font-bold text-orange-700">{ciplItemLoad}</p>
            </article>
          </section>
          <section className="card p-5" aria-labelledby="events-attention-title">
            <h2 id="events-attention-title" className="text-lg font-semibold">
              Attention
            </h2>
            {eventOverlapsThisWeek.length ||
            venueConflicts.length ||
            ciplsNotReady.length ||
            cancelledEvents.length ? (
              <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
                {eventOverlapsThisWeek.length > 0 && (
                  <li className="flex gap-2">
                    <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={16} />
                    <span>{eventOverlapsThisWeek.length} event overlap minggu ini.</span>
                  </li>
                )}
                {venueConflicts.length > 0 && (
                  <li className="flex gap-2">
                    <MapPin className="mt-0.5 shrink-0 text-amber-600" size={16} />
                    <span>{venueConflicts.length} konflik venue.</span>
                  </li>
                )}
                {ciplsNotReady.length > 0 && (
                  <li className="flex gap-2">
                    <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={16} />
                    <span>{ciplsNotReady.length} CIPL belum ready.</span>
                  </li>
                )}
                {cancelledEvents.length > 0 && (
                  <li className="flex gap-2 text-rose-700">
                    <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                    <span>
                      {cancelledEvents.length} event dibatalkan dan perlu ditindaklanjuti.
                    </span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Tidak ada perhatian operasional saat ini.
              </p>
            )}
          </section>
        </div>
        <section>
          <div className="mb-5 p-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative w-full lg:w-80 lg:flex-none">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="input m-0 border-0 bg-slate-50 pl-10 shadow-none"
                  placeholder="Cari nama event, alias, atau EO"
                />
              </label>
              <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 px-0 py-2">
                {[
                  ['active', 'Aktif'],
                  ['all', 'All'],
                  ['soon', 'Soon'],
                  ['ongoing', 'On going'],
                  ['done', 'Done'],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="event-status"
                      value={value}
                      checked={status === value}
                      onChange={() => setStatus(value as EventFilter)}
                      className="h-4 w-4 accent-orange-600"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800"
              >
                Reset filter
              </button>
            )}
          </div>
          {filteredEvents.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredEvents.map((event) => {
                const isCancelledEvent = isCancelled(event)
                const isPastEvent =
                  isCancelledEvent || getEventStatus(event.startsAt, event.endsAt) === 'done'
                const exhibitors = exhibitorsByEvent[event.id] ?? []
                const eventJobs = jobsByEvent[event.id] ?? []
                return (
                  <article
                    key={event.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/events/${event.id}`)}
                    onKeyDown={(keyboardEvent) => {
                      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                        keyboardEvent.preventDefault()
                        router.push(`/events/${event.id}`)
                      }
                    }}
                    className={`card group flex h-full cursor-pointer flex-col p-5 ${
                      isPastEvent
                        ? 'grayscale opacity-75 transition duration-200 hover:brightness-75'
                        : 'hover:border-orange-200 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3
                          className={`mt-2 min-w-0 overflow-hidden whitespace-nowrap text-lg font-semibold leading-snug ${
                            isPastEvent ? 'text-slate-600' : 'group-hover:text-orange-700'
                          }`}
                        >
                          <span
                            className={
                              event.officialName.length > 28
                                ? 'event-title-marquee inline-block'
                                : 'inline-block'
                            }
                          >
                            {event.officialName.length > 28
                              ? `${event.officialName}   •   ${event.officialName}`
                              : event.officialName}
                          </span>
                        </h3>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation()
                              if (isPastEvent) return
                              setNewJobForEvent(event)
                            }}
                            disabled={isPastEvent}
                            aria-label={`Buat job untuk ${event.officialName}`}
                            title="Buat job"
                            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              isPastEvent
                                ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                                : 'bg-orange-600 text-white hover:bg-orange-700'
                            }`}
                          >
                            <Plus size={14} />
                          </button>
                          <span
                            className={`text-sm ${isPastEvent ? 'text-slate-400' : 'text-slate-600'}`}
                          >
                            {eventJobs.length} job
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation()
                              setOpenMenuEventId((current) => (current === event.id ? null : event.id))
                            }}
                            aria-label={`Menu aksi untuk ${event.officialName}`}
                            aria-expanded={openMenuEventId === event.id}
                            aria-haspopup="menu"
                            title="Menu"
                            className="rounded-lg p-2 text-slate-500 hover:bg-orange-50 hover:text-orange-700"
                          >
                            <MoreVertical size={20} />
                          </button>
                          {openMenuEventId === event.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                role="presentation"
                                onClick={() => setOpenMenuEventId(null)}
                              />
                              <div
                                role="menu"
                                aria-label={`Aksi untuk ${event.officialName}`}
                                className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg"
                              >
                                <button
                                  role="menuitem"
                                  type="button"
                                  onClick={(clickEvent) => {
                                    clickEvent.stopPropagation()
                                    setOpenMenuEventId(null)
                                    setEditingEvent(event)
                                  }}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <Pencil size={15} /> Edit
                                </button>
                                <button
                                  role="menuitem"
                                  type="button"
                                  onClick={(clickEvent) => {
                                    clickEvent.stopPropagation()
                                    setOpenMenuEventId(null)
                                    setDeletingEvent(event)
                                  }}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 size={15} /> Hapus
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{event.alias || ''}</p>
                    {isCancelledEvent && (
                      <p className="mt-3 w-fit rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        Dibatalkan
                      </p>
                    )}
                    <div className="mt-5 space-y-3 border-t pt-4">
                      <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-sm text-slate-600">
                        <CalendarDays className="text-slate-400" size={16} />
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{formatEventDateRange(event.startsAt, event.endsAt)}</span>
                          <span className="shrink-0 rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
                            {isCancelledEvent
                              ? 'Dibatalkan'
                              : getEventTiming(event.startsAt, event.endsAt)}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-sm text-slate-600">
                        <MapPin className="text-slate-400" size={16} />
                        <span>{event.venue?.officialName || 'Venue belum diinput'}</span>
                      </div>
                      <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-xs text-slate-500">
                        <Building2 className="text-slate-400" size={15} />
                        <span>{event.eventOrganizer?.legalName || 'Belum diinput'}</span>
                      </div>
                      <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-xs text-slate-500">
                        <User className="mt-0.5 text-slate-400" size={15} />
                        <span>PIC: {event.picName || 'Belum diinput'}</span>
                      </div>
                      <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-xs text-slate-500">
                        <Users className="mt-0.5 text-slate-400" size={15} />
                        <div>
                          <button
                            type="button"
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation()
                              setExpandedExhibitorEventId((current) =>
                                current === event.id ? null : event.id,
                              )
                            }}
                            aria-expanded={expandedExhibitorEventId === event.id}
                            className="font-medium text-slate-600 hover:text-orange-700"
                          >
                            {exhibitors.length} exhibitor
                          </button>
                          {expandedExhibitorEventId === event.id && exhibitors.length > 0 && (
                            <div className="relative mt-3 h-36 w-full min-w-[240px] overflow-hidden">
                              <svg
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                className="pointer-events-none absolute inset-0 h-full w-full"
                                aria-hidden="true"
                              >
                                {exhibitors.map((exhibitor, index) => {
                                  const y = ((index + 1) / (exhibitors.length + 1)) * 100
                                  return (
                                    <path
                                      key={exhibitor.id}
                                      d={`M 25 50 C 38 50, 36 ${y}, 57 ${y}`}
                                      fill="none"
                                      stroke="#1f2937"
                                      strokeWidth="1.2"
                                    />
                                  )
                                })}
                              </svg>
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-700">
                                Exhibitors
                              </span>
                              {exhibitors.map((exhibitor, index) => {
                                const y = ((index + 1) / (exhibitors.length + 1)) * 100
                                return (
                                  <span
                                    key={exhibitor.id}
                                    className="absolute left-[57%] w-[42%] -translate-y-1/2 truncate text-xs text-slate-800"
                                    style={{ top: `${y}%` }}
                                    title={exhibitor.legalName}
                                  >
                                    {exhibitor.legalName}
                                    {exhibitor.type === 'LOCAL' && ' · Lokal'}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <p className="font-medium">
                {events.length ? 'Tidak ada event yang sesuai' : 'Belum ada event'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {events.length ? 'Coba ubah atau reset filter.' : 'Event perlu tersedia lebih dulu untuk membuat job.'}
              </p>
              {!events.length && (
                <button type="button" onClick={() => setShowNewEvent(true)} className="btn-primary mt-6">
                  <Plus size={16} /> <span className="ml-2">New event</span>
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      {showNewEvent && (
        <EventFormModal
          onSaved={() => {
            setShowNewEvent(false)
            reloadEvents()
          }}
          onCancel={() => setShowNewEvent(false)}
        />
      )}
      {editingEvent && (
        <EventFormModal
          event={editingEvent}
          onSaved={() => {
            setEditingEvent(null)
            reloadEvents()
          }}
          onCancel={() => setEditingEvent(null)}
        />
      )}
      {deletingEvent && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(mouseEvent) => {
            if (!deleting && mouseEvent.target === mouseEvent.currentTarget) setDeletingEvent(null)
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-event-title"
            className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h2 id="delete-event-title" className="text-lg font-bold">
                  Hapus event?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  <span className="font-semibold">{deletingEvent.officialName}</span> beserta
                  exhibitor, job, CIPL, dokumen shipment, dan ticket yang terikat padanya akan
                  dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingEvent(null)}
                disabled={deleting}
                className="btn-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? 'Menghapus...' : 'Hapus permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
      {newJobForEvent && (
        <JobInitModal
          event={newJobForEvent}
          onCreated={() => {
            setNewJobForEvent(null)
            reloadEvents()
          }}
          onCancel={() => setNewJobForEvent(null)}
        />
      )}
    </>
  )
}
