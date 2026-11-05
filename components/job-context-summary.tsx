'use client'

import { useEffect, useState } from 'react'

import { listEvents, type LocalEvent } from '@/lib/data-client'
import type { JobContext } from '@/lib/job-context'
import { JobEventInfoSkeleton } from '@/components/loading-skeletons'

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))

function eventDates(event: LocalEvent): string | null {
  const from = event.startsOn && event.startsOn !== 'null' ? formatDate(event.startsOn) : null
  const to = event.endsOn && event.endsOn !== 'null' ? formatDate(event.endsOn) : null
  return from && to && from !== to ? `${from} – ${to}` : (from ?? to)
}

/** Nama event serta venue · tanggal pameran; gagal memuat tidak menghalangi halaman job. */
function EventContextSummary({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<LocalEvent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    listEvents()
      .then((rows) => {
        if (active) setEvent(rows.find((row) => row.id === eventId) ?? null)
      })
      .catch(() => {
        if (active) setEvent(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [eventId])

  if (loading) return <JobEventInfoSkeleton />
  return (
    <>
      <p className="mt-2 text-base font-semibold text-slate-800">{event?.officialName ?? 'Event'}</p>
      <p className="mt-1 text-sm text-slate-500">
        {[event?.venue?.name, event ? eventDates(event) : null].filter(Boolean).join(' · ') ||
          'Informasi event belum tersedia'}
      </p>
    </>
  )
}

/** Ringkasan konteks job di header detail job; isinya mengikuti jenis konteks. */
export function JobContextSummary({ context }: { context: JobContext }) {
  switch (context.kind) {
    case 'EVENT':
      return <EventContextSummary eventId={context.eventId} />
  }
}
