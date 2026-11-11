// Sub-komponen SERVER untuk dashboard: panel "Perlu tindakan" (daftar konkret hasil agregat insight
// yang masing-masing menautkan ke detail event agar staff langsung bisa membuka dan bertindak) dan
// daftar kandidat arsip. Murni presentasi — seluruh perhitungan hidup di repository
// (`computeInsights`).

import Link from 'next/link'
import { Archive, CalendarClock, ClipboardList, Hourglass, MapPin } from 'lucide-react'

import type { EventInsightItem, EventInsights } from '@/domain/event/types'

import { formatDateRange } from '@/features/events/components/event-presentation'

// Batas tampil per seksi — sisanya diringkas "dan N lainnya" agar panel tetap ringkas.
const MAX_ITEMS = 5

type Tone = 'critical' | 'warning'

const toneClasses: Record<Tone, { icon: string; badge: string }> = {
  critical: { icon: 'text-destructive', badge: 'bg-destructive/10 text-destructive' },
  warning: { icon: 'text-primary', badge: 'bg-primary/10 text-primary' },
}

function InsightList({ items }: { items: EventInsightItem[] }) {
  const hidden = items.length - MAX_ITEMS
  return (
    <ul className="mt-2 flex flex-col gap-1.5 text-sm">
      {items.slice(0, MAX_ITEMS).map((item) => (
        <li key={item.id} className="flex min-w-0 items-baseline justify-between gap-3">
          <Link
            href={`/events/${item.id}`}
            className="min-w-0 truncate font-medium hover:text-primary"
            title={item.name}
          >
            {item.name}
          </Link>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDateRange(item.startsOn, item.endsOn)}
          </span>
        </li>
      ))}
      {hidden > 0 ? (
        <li className="text-xs text-muted-foreground">dan {hidden} lainnya</li>
      ) : null}
    </ul>
  )
}

function Section({
  icon: Icon,
  tone,
  title,
  hint,
  count,
  children,
}: {
  icon: typeof MapPin
  tone: Tone
  title: string
  hint: string
  count: number
  children: React.ReactNode
}) {
  const classes = toneClasses[tone]
  return (
    <section className="min-w-0 rounded-xl border border-border p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon size={16} className={`shrink-0 ${classes.icon}`} aria-hidden="true" />
        <span className="min-w-0 truncate">{title}</span>
        <span
          className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${classes.badge}`}
        >
          {count}
        </span>
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      {children}
    </section>
  )
}

/**
 * Event selesai yang benar-benar siap diarsipkan: `archivable` dikurangi yang masih punya job
 * belum tuntas (itu masuk "Perlu tindakan", bukan arsip).
 */
function archiveCandidates(insights: EventInsights): EventInsightItem[] {
  const unfinished = new Set(insights.unfinishedAfterShow.map((item) => item.id))
  return insights.archivable.filter((item) => !unfinished.has(item.id))
}

/**
 * Panel "Perlu tindakan", urut keparahan: konflik venue → job menggantung setelah pameran tutup →
 * event ≤14 hari → event ≤30 hari tanpa job. Kandidat arsip sengaja TIDAK di sini (lihat
 * `EventArchiveCandidates`). Seluruh seksi kosong → pesan tenang, bukan panel hampa.
 */
export function EventInsightsPanel({ insights }: { insights: EventInsights }) {
  const total =
    insights.venueConflicts.length +
    insights.unfinishedAfterShow.length +
    insights.dueSoon.length +
    insights.soonWithoutJob.length

  return (
    <section className="card p-5 sm:p-6" aria-label="Perlu tindakan">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Perlu tindakan</h2>
        <p className="text-sm text-muted-foreground">
          {total === 0 ? 'Semua terkendali' : `${total} hal menunggu keputusan`}
        </p>
      </div>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Tidak ada yang perlu ditindaklanjuti saat ini.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {insights.venueConflicts.length > 0 ? (
            <Section
              icon={MapPin}
              tone="critical"
              title="Konflik venue"
              hint={`Venue dipakai lebih dari satu event pada rentang beririsan (${insights.scheduleOverlapCount} pasangan jadwal beririsan secara keseluruhan).`}
              count={insights.venueConflicts.length}
            >
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {insights.venueConflicts.slice(0, MAX_ITEMS).map((group) => (
                  <li key={group.venueName} className="min-w-0">
                    <p className="truncate font-medium" title={group.venueName}>
                      {group.venueName}
                    </p>
                    <p className="flex flex-wrap gap-x-2 text-xs">
                      {group.events.map((event) => (
                        <Link
                          key={event.id}
                          href={`/events/${event.id}`}
                          className="truncate text-muted-foreground hover:text-primary"
                          title={event.name}
                        >
                          {event.name}
                        </Link>
                      ))}
                    </p>
                  </li>
                ))}
                {insights.venueConflicts.length > MAX_ITEMS ? (
                  <li className="text-xs text-muted-foreground">
                    dan {insights.venueConflicts.length - MAX_ITEMS} lainnya
                  </li>
                ) : null}
              </ul>
            </Section>
          ) : null}

          {insights.unfinishedAfterShow.length > 0 ? (
            <Section
              icon={Hourglass}
              tone="critical"
              title="Pameran selesai, job belum tuntas"
              hint="Masih ada pekerjaan menggantung setelah pameran tutup — paling lama di atas."
              count={insights.unfinishedAfterShow.length}
            >
              <InsightList items={insights.unfinishedAfterShow} />
            </Section>
          ) : null}

          {insights.dueSoon.length > 0 ? (
            <Section
              icon={CalendarClock}
              tone="warning"
              title="Mulai ≤14 hari"
              hint="Event terdekat — pastikan persiapan sudah berjalan."
              count={insights.dueSoon.length}
            >
              <InsightList items={insights.dueSoon} />
            </Section>
          ) : null}

          {insights.soonWithoutJob.length > 0 ? (
            <Section
              icon={ClipboardList}
              tone="warning"
              title="Mulai ≤30 hari, belum ada job"
              hint="Belum ada satu pun pekerjaan tercatat untuk event ini."
              count={insights.soonWithoutJob.length}
            >
              <InsightList items={insights.soonWithoutJob} />
            </Section>
          ) : null}
        </div>
      )}
    </section>
  )
}

/**
 * Kandidat arsip: event selesai tanpa job menggantung namun masih ACTIVE. Urusan kebersihan data,
 * bukan urgensi — dirender di bagian bawah dashboard. Kosong → tidak dirender.
 */
export function EventArchiveCandidates({ insights }: { insights: EventInsights }) {
  const items = archiveCandidates(insights)
  if (items.length === 0) return null
  return (
    <section className="card p-4" aria-label="Kandidat arsip">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Archive size={15} aria-hidden="true" />
        Selesai, belum diarsipkan
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums">
          {items.length}
        </span>
      </h2>
      <InsightList items={items} />
    </section>
  )
}
