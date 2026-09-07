'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CalendarDays,
  MapPin,
  Pencil,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react'
import { EventForm } from '@/components/event-form'
import {
  listEventExhibitors,
  listEvents,
  type LocalEvent,
  type LocalExhibitor,
} from '@/lib/indexeddb'
import { EventExhibitorModal } from '@/components/event-exhibitor-modal'
import { EventTimeline } from '@/components/event-timeline'

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

function getTimelineDays(startsAt: string, endsAt: string) {
  return Math.max(
    1,
    Math.floor((calendarDay(new Date(endsAt)) - calendarDay(new Date(startsAt))) / DAY) + 1,
  )
}

function getLeadTimeDays(event: LocalEvent) {
  const leadTime = Math.floor(
    (calendarDay(new Date(event.startsAt)) - calendarDay(new Date(event.createdAt))) / DAY,
  )
  return leadTime >= 0 ? leadTime : null
}

function getEventPosition(startsAt: string, endsAt: string, today = new Date()) {
  const start = calendarDay(new Date(startsAt))
  const end = calendarDay(new Date(endsAt))
  const current = calendarDay(today)
  const progress = Math.round(
    Math.min(1, Math.max(0, (current - start) / Math.max(1, end - start))) * 100,
  )

  if (current < start) return { label: 'Belum dimulai', progress: 0 }
  if (current > end) return { label: 'Selesai', progress: 100 }
  return { label: 'Berlangsung', progress }
}

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [exhibitorsByEvent, setExhibitorsByEvent] = useState<Record<string, LocalExhibitor[]>>({})
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [addingExhibitorsToEvent, setAddingExhibitorsToEvent] = useState<LocalEvent | null>(null)
  const [expandedExhibitorEventId, setExpandedExhibitorEventId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EventFilter>('active')
  const reloadEvents = () => {
    listEvents().then((loadedEvents) => {
      setEvents(loadedEvents)
      Promise.all(
        loadedEvents.map(async (event) => [event.id, await listEventExhibitors(event.id)] as const),
      ).then((eventExhibitors) => setExhibitorsByEvent(Object.fromEntries(eventExhibitors)))
    })
  }
  useEffect(() => {
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
      ...(exhibitorsByEvent[event.id] ?? []).flatMap((exhibitor) => [
        exhibitor.legalName,
        exhibitor.aliasName,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch)
    const matchesStatus =
      status === 'all' ||
      (status === 'active' && getEventStatus(event.startsAt, event.endsAt) !== 'done') ||
      getEventStatus(event.startsAt, event.endsAt) === status

    return matchesSearch && matchesStatus
  })

  const hasFilters = Boolean(search || status !== 'active')
  const clearFilters = () => {
    setSearch('')
    setStatus('active')
  }

  return (
    <>
      <div className="space-y-8">
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
              <button
                type="button"
                onClick={() => setShowNewEvent(true)}
                className="btn-primary shrink-0 lg:ml-auto"
              >
                <Plus size={16} /> New Event
              </button>
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
                const isPastEvent = getEventStatus(event.startsAt, event.endsAt) === 'done'
                const exhibitors = exhibitorsByEvent[event.id] ?? []
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
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation()
                            if (isPastEvent) return
                            setAddingExhibitorsToEvent(event)
                          }}
                          disabled={isPastEvent}
                          aria-label={`Tambah exhibitor untuk ${event.officialName}`}
                          title="Tambah exhibitor"
                          className={`rounded-lg p-2 text-slate-500 ${
                            isPastEvent
                              ? 'cursor-not-allowed opacity-40'
                              : 'hover:bg-orange-50 hover:text-orange-700'
                          }`}
                        >
                          <Users size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{event.alias || ''}</p>
                    <div className="mt-5 space-y-3 border-t pt-4">
                      <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 text-sm text-slate-600">
                        <CalendarDays className="text-slate-400" size={16} />
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{formatEventDateRange(event.startsAt, event.endsAt)}</span>
                          <span className="shrink-0 rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
                            {getEventTiming(event.startsAt, event.endsAt)}
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
                {events.length ? 'Coba ubah atau reset filter.' : 'Buat event pertama untuk mulai.'}
              </p>
            </div>
          )}
        </section>
      </div>
      {showNewEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowNewEvent(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-event-title"
            className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden lg:max-w-[50vw]"
          >
            <div className="flex shrink-0 items-center justify-between border-b px-6 py-5 sm:px-8">
              <div>
                <h2 id="new-event-title" className="text-xl font-bold">
                  Form Input Pameran
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewEvent(false)}
                aria-label="Tutup form event"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
              >
                <X size={20} />
              </button>
            </div>
            <EventForm
              onSaved={() => {
                setShowNewEvent(false)
                reloadEvents()
              }}
              onCancel={() => setShowNewEvent(false)}
            />
          </div>
        </div>
      )}
      {addingExhibitorsToEvent && (
        <EventExhibitorModal
          event={addingExhibitorsToEvent}
          onSaved={() => {
            setAddingExhibitorsToEvent(null)
            reloadEvents()
          }}
          onCancel={() => setAddingExhibitorsToEvent(null)}
        />
      )}
    </>
  )
}
