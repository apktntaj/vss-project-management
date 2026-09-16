'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { EventTimeline } from '@/components/event-timeline'
import { PageSkeleton } from '@/components/loading-skeletons'
import { Button, buttonVariants } from '@/components/ui/button'
import { listEvents, listJobs, type LocalEvent, type LocalJob } from '@/lib/data-client'

export default function Dashboard() {
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [jobs, setJobs] = useState<LocalJob[]>([])
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
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow mb-2">Workspace overview</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Kendali operasional Anda.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Dari persiapan event hingga pengiriman. Lihat progres dan tentukan langkah berikutnya.
          </p>
        </div>
        <Link href="/jobs/new" className={buttonVariants({ size: 'lg' })}>
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
      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Agenda terdekat</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Event berlangsung dan persiapan berikutnya.
              </p>
            </div>
            <Link href="/events" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Semua event <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
          {upcoming.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {upcoming.slice(0, 3).map((event) => {
                const started = day(event.startsOn) <= today
                const start = new Date(day(event.startsOn))
                return (
                  <li key={event.id}>
                    <Link
                      href={`/events/${event.id}`}
                      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-background sm:px-6"
                    >
                      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                          {start.toLocaleDateString('id-ID', { month: 'short' })}
                        </span>
                        <span className="text-lg font-semibold leading-tight">
                          {start.getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold group-hover:text-primary">
                          {event.officialName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {start.toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          · {started ? 'Berlangsung' : 'Mendatang'}
                        </p>
                      </div>
                      <ArrowUpRight size={17} className="shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-3 px-6 pb-7">
              <CalendarDays className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Belum ada agenda mendatang. Kelola event untuk mulai menyusun jadwal operasional.
              </p>
              <Link href="/events" className={buttonVariants({ variant: 'outline' })}>
                Kelola event <ArrowRight data-icon="inline-end" />
              </Link>
            </div>
          )}
        </section>
        <section className="card flex flex-col gap-5 p-5 sm:p-6">
          <div>
            <p className="eyebrow mb-2">Langkah berikutnya</p>
            <h2 className="text-lg font-semibold tracking-tight">Ruang kerja tim</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Akses cepat untuk pekerjaan sehari-hari.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {[
              {
                href: '/kanban',
                icon: BriefcaseBusiness,
                title: 'Buka ticket saya',
                detail: 'Tindak lanjuti tugas dan koordinasi tim',
              },
              {
                href: '/lartas',
                icon: ShieldCheck,
                title: 'Cek ketentuan LARTAS',
                detail: 'Telusuri persyaratan barang kiriman',
              },
            ].map(({ href, icon: Icon, title, detail }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-background"
              >
                <Icon size={19} className="shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
                </div>
                <ArrowUpRight size={16} className="shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section aria-label="Timeline operasional" className="min-w-0">
        <EventTimeline events={activeEvents} jobs={jobs} />
      </section>
    </div>
  )
}
