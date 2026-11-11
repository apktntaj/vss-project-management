'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Clock3, MapPin, Plus } from 'lucide-react'
import { EventTimeline } from '@/components/event-timeline'
import { PageSkeleton } from '@/components/loading-skeletons'
import { Button, buttonVariants } from '@/components/ui/button'
import { listEvents, listJobs, type LocalEvent, type Job } from '@/lib/data-client'

/**
 * Konten overview dashboard (client): metrik dan timeline — data event/job via data-client.
 * `insightsSlot` adalah slot server-rendered (panel "Perlu tindakan") yang disisipkan DI ANTARA
 * metrik dan timeline agar urutan halaman mengikuti prioritas urgensi, tanpa memecah pemilikan
 * data client.
 */
export function DashboardOverview({ insightsSlot }: { insightsSlot?: ReactNode }) {
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    Promise.all([listEvents(), listJobs()])
      .then(([loadedEvents, loadedJobs]) => {
        if (!active) return
        setEvents(loadedEvents)
        setJobs(loadedJobs)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attempt])

  if (loading) return <PageSkeleton />
  if (error)
    return (
      <section className="card flex flex-col items-start gap-4 p-8" role="alert">
        <h1 className="text-xl font-semibold">Ringkasan belum dapat dimuat</h1>
        <p className="text-sm text-muted-foreground">
          Coba muat ulang untuk mendapatkan data event dan pekerjaan terbaru.
        </p>
        <Button onClick={() => setAttempt((value) => value + 1)}>Coba lagi</Button>
      </section>
    )

  const day = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).getTime()
  const today = new Date().setHours(0, 0, 0, 0)
  const activeEvents = events.filter((event) => event.status !== 'CANCELLED')
  const upcoming = activeEvents
    .filter((event) => day(event.endsOn) >= today)
    .sort((a, b) => day(a.startsOn) - day(b.startsOn))
  const ongoing = upcoming.filter((event) => day(event.startsOn) <= today)
  const activeJobs = jobs.filter((job) => job.status === 'IN_PROGRESS')
  const heldJobs = jobs.filter((job) => job.status === 'ON_HOLD')
  const metrics = [
    {
      label: 'Event terjadwal',
      value: upcoming.length,
      detail: `${ongoing.length} sedang berlangsung`,
      icon: CalendarDays,
      href: '/events',
    },
    {
      label: 'Pekerjaan berjalan',
      value: activeJobs.length,
      detail: `${jobs.length} total pekerjaan tercatat`,
      icon: BriefcaseBusiness,
      href: '/jobs',
    },
    {
      label: 'Pekerjaan tertahan',
      value: heldJobs.length,
      detail: heldJobs.length
        ? 'Periksa kendala untuk melanjutkan'
        : 'Tidak ada pekerjaan berstatus on hold',
      icon: Clock3,
      href: '/jobs',
    },
    {
      label: 'Venue terdaftar',
      value: new Set(activeEvents.map((event) => event.venueId)).size,
      detail: `Dari ${activeEvents.length} event yang tidak dibatalkan`,
      icon: MapPin,
      href: '/events',
    },
  ]

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Yang sedang terjadi dan yang perlu diputuskan hari ini.
          </p>
        </div>
        <Link href="/jobs/new" className={buttonVariants()}>
          <Plus data-icon="inline-start" /> Buat pekerjaan
        </Link>
      </header>
      <section
        aria-label="Ringkasan operasional"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map(({ label, value, detail, icon: Icon, href }) => (
          <Link key={label} href={href} className="dashboard-metric">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon size={19} />
              </span>
              <ArrowUpRight className="text-muted-foreground" size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{value}</p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
          </Link>
        ))}
      </section>
      {insightsSlot}
      <section aria-label="Timeline operasional" className="min-w-0">
        <EventTimeline events={activeEvents} jobs={jobs} />
      </section>
    </div>
  )
}
