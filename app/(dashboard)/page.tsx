'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import { EventTimeline } from '@/components/event-timeline'
import { listEvents, listJobs, type LocalEvent, type LocalJob } from '@/lib/data-client'

export default function Dashboard() {
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [jobs, setJobs] = useState<LocalJob[]>([])

  useEffect(() => {
    Promise.all([listEvents(), listJobs()]).then(([loadedEvents, loadedJobs]) => {
      setEvents(loadedEvents)
      setJobs(loadedJobs)
    })
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mt-2 text-4xl font-bold">Overview</h1>
        <p className="mt-2 text-sm text-slate-500">
          Pantau persiapan, pelaksanaan, dan pekerjaan setelah event dalam satu timeline.
        </p>
      </div>
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
      <EventTimeline events={events} jobs={jobs} />
    </div>
  )
}
