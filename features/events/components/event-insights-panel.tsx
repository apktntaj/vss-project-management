// Sub-komponen SERVER untuk panel "Perlu tindakan": daftar konkret hasil agregat insight yang
// masing-masing menautkan ke detail event agar staff langsung bisa membuka dan bertindak. Murni
// presentasi — seluruh perhitungan hidup di repository (`computeInsights`).

import Link from 'next/link'
import { Archive, CalendarClock, ClipboardList, Hourglass, MapPin } from 'lucide-react'

import type { EventInsightItem, EventInsights } from '@/domain/event/types'

import { formatDateRange } from '@/features/events/components/event-presentation'

// Batas tampil per seksi — sisanya diringkas "dan N lainnya" agar panel tetap ringkas.
const MAX_ITEMS = 5

function InsightList({ items }: { items: EventInsightItem[] }) {
  const hidden = items.length - MAX_ITEMS
  return (
    <ul className="mt-2 flex flex-col gap-1.5 text-sm">
      {items.slice(0, MAX_ITEMS).map((item) => (
        <li key={item.id} className="flex min-w-0 items-baseline justify-between gap-3">
          <Link
            href={`/events/${item.id}`}
            className="min-w-0 truncate font-medium text-slate-700 hover:text-orange-700"
            title={item.name}
          >
            {item.name}
          </Link>
          <span className="shrink-0 text-xs text-slate-500">
            {formatDateRange(item.startsOn, item.endsOn)}
          </span>
        </li>
      ))}
      {hidden > 0 ? <li className="text-xs text-slate-500">dan {hidden} lainnya</li> : null}
    </ul>
  )
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon}
        {title}
        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
          {count}
        </span>
      </h3>
      {children}
    </section>
  )
}

/**
 * Panel "Perlu tindakan": event ≤14 hari, event ≤30 hari tanpa job, konflik venue/jadwal, dan
 * kandidat arsip. Seluruh seksi kosong → pesan tenang, bukan panel hampa.
 */
export function EventInsightsPanel({ insights }: { insights: EventInsights }) {
  const isEmpty =
    insights.dueSoon.length === 0 &&
    insights.soonWithoutJob.length === 0 &&
    insights.unfinishedAfterShow.length === 0 &&
    insights.venueConflicts.length === 0 &&
    insights.archivable.length === 0

  return (
    <section className="card p-5" aria-label="Perlu tindakan">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        Perlu tindakan
      </h2>
      {isEmpty ? (
        <p className="mt-2 text-sm text-slate-500">Tidak ada yang perlu ditindak lanjuti.</p>
      ) : (
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          {insights.dueSoon.length > 0 ? (
            <Section
              icon={<CalendarClock size={16} className="text-orange-600" aria-hidden="true" />}
              title="Segera (≤14 hari)"
              count={insights.dueSoon.length}
            >
              <InsightList items={insights.dueSoon} />
            </Section>
          ) : null}

          {insights.unfinishedAfterShow.length > 0 ? (
            <Section
              icon={<Hourglass size={16} className="text-amber-600" aria-hidden="true" />}
              title="Pameran selesai, belum tuntas"
              count={insights.unfinishedAfterShow.length}
            >
              <p className="mt-1 text-xs text-slate-500">
                Pameran sudah tutup namun masih ada job dengan dokumen/kepulangan belum selesai.
              </p>
              <InsightList items={insights.unfinishedAfterShow} />
            </Section>
          ) : null}

          {insights.soonWithoutJob.length > 0 ? (
            <Section
              icon={<ClipboardList size={16} className="text-amber-600" aria-hidden="true" />}
              title="Belum ada job (≤30 hari)"
              count={insights.soonWithoutJob.length}
            >
              <InsightList items={insights.soonWithoutJob} />
            </Section>
          ) : null}

          {insights.venueConflicts.length > 0 ? (
            <Section
              icon={<MapPin size={16} className="text-rose-600" aria-hidden="true" />}
              title="Konflik venue"
              count={insights.venueConflicts.length}
            >
              <p className="mt-1 text-xs text-slate-500">
                {insights.scheduleOverlapCount} pasangan jadwal beririsan; venue berikut dipakai
                lebih dari satu event pada rentang yang beririsan:
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {insights.venueConflicts.slice(0, MAX_ITEMS).map((group) => (
                  <li key={group.venueName} className="min-w-0">
                    <p className="truncate font-medium text-slate-700" title={group.venueName}>
                      {group.venueName}
                    </p>
                    <p className="flex flex-wrap gap-x-2 text-xs text-slate-500">
                      {group.events.map((event) => (
                        <Link
                          key={event.id}
                          href={`/events/${event.id}`}
                          className="truncate text-slate-600 hover:text-orange-700"
                          title={event.name}
                        >
                          {event.name}
                        </Link>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {insights.archivable.length > 0 ? (
            <Section
              icon={<Archive size={16} className="text-slate-500" aria-hidden="true" />}
              title="Selesai, belum diarsipkan"
              count={insights.archivable.length}
            >
              <InsightList items={insights.archivable} />
            </Section>
          ) : null}
        </div>
      )}
    </section>
  )
}
