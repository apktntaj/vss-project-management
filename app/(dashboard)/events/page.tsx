'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, CalendarDays, MapPin, PackagePlus, Pencil, Plus, Search, X } from 'lucide-react'
import { EventForm } from '@/components/event-form'
import { listEvents, type LocalEvent } from '@/lib/indexeddb'
import { EventJobModal } from '@/components/event-job-modal'

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

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [addingJobToEvent, setAddingJobToEvent] = useState<LocalEvent | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EventStatus | ''>('')
  const reloadEvents = () => {
    listEvents().then(setEvents)
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
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch)
    const matchesStatus = !status || getEventStatus(event.startsAt, event.endsAt) === status

    return matchesSearch && matchesStatus
  })

  const hasFilters = Boolean(search || status)
  const clearFilters = () => {
    setSearch('')
    setStatus('')
  }

  return (
    <>
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="card p-5">
            <CalendarDays className="text-orange-600" size={20} />
            <p className="mt-4 text-sm text-slate-500">Total event</p>
            <p className="mt-1 text-3xl font-bold">{events.length}</p>
          </article>
          <article className="card p-5">
            <MapPin className="text-blue-600" size={20} />
            <p className="mt-4 text-sm text-slate-500">Venue terdaftar</p>
            <p className="mt-1 text-3xl font-bold">
              {new Set(events.map((event) => event.venueId)).size}
            </p>
          </article>
          <article className="card p-5">
            <CalendarDays className="text-emerald-600" size={20} />
            <p className="mt-4 text-sm text-slate-500">Event mendatang</p>
            <p className="mt-1 text-3xl font-bold">
              {events.filter((event) => new Date(event.endsAt) >= new Date()).length}
            </p>
          </article>
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
                  ['', 'All'],
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
                      onChange={() => setStatus(value as EventStatus | '')}
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
              {filteredEvents.map((event) => (
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
                  className="card group flex h-full cursor-pointer flex-col p-5 hover:border-orange-200 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="mt-2 text-lg font-semibold leading-snug group-hover:text-orange-700">
                        {event.officialName}
                      </h3>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        href={`/events/${event.id}/edit`}
                        onClick={(clickEvent) => clickEvent.stopPropagation()}
                        aria-label={`Edit event ${event.officialName}`}
                        title="Edit event"
                        className="rounded-lg p-2 text-slate-500 hover:bg-orange-50 hover:text-orange-700"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          setAddingJobToEvent(event)
                        }}
                        aria-label={`Tambah job untuk ${event.officialName}`}
                        title="Tambah job"
                        className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <PackagePlus size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{event.alias || ''}</p>
                  <div className="mt-5 space-y-3 border-t pt-4">
                    <p className="flex items-start gap-2 text-sm text-slate-600">
                      <CalendarDays className="shrink-0 text-slate-400" size={16} />
                      <span>{formatEventDateRange(event.startsAt, event.endsAt)}</span>
                      <span className="shrink-0 rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
                        {getEventTiming(event.startsAt, event.endsAt)}
                      </span>
                    </p>
                    <p className="flex items-start gap-2 text-sm text-slate-600">
                      <MapPin className="shrink-0 text-slate-400" size={16} />
                      <span>{event.venue?.officialName || 'Venue belum diinput'}</span>
                    </p>
                    <p className="flex items-start gap-2 text-xs text-slate-500">
                      <Building2 className="shrink-0 text-slate-400" size={15} />
                      <span>{event.eventOrganizer?.legalName || 'Belum diinput'}</span>
                    </p>
                  </div>
                </article>
              ))}
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
            className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden"
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
      {addingJobToEvent && (
        <EventJobModal
          event={addingJobToEvent}
          onSaved={() => setAddingJobToEvent(null)}
          onCancel={() => setAddingJobToEvent(null)}
        />
      )}
    </>
  )
}
