'use client'

import { useEffect, useState } from 'react'
import { EventTimeline } from '@/components/event-timeline'
import { listEvents, type LocalEvent } from '@/lib/indexeddb'

export default function Dashboard() {
  const [events, setEvents] = useState<LocalEvent[]>([])

  useEffect(() => {
    listEvents().then(setEvents)
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Operations overview</p>
        <h1 className="mt-2 text-3xl font-bold">Event dashboard</h1>
        <p className="mt-2 text-sm text-slate-500">
          Pantau persiapan, pelaksanaan, dan pekerjaan setelah event dalam satu timeline.
        </p>
      </div>
      <EventTimeline events={events} />
    </div>
  )
}
