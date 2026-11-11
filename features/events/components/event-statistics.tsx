// Sub-komponen SERVER untuk statistik perencanaan di bagian bawah dashboard: ranking EO, jumlah event
// per bulan, dan venue terpadat. Murni informasi (tanpa drill-down); seluruh agregat sudah
// dihitung repository.

import type { EventInsights, EventNameCount } from '@/domain/event/types'

import { formatMonth } from '@/features/events/components/event-presentation'

function CountList({ items, unit }: { items: EventNameCount[]; unit: string }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5 text-sm">
      {items.map((item) => (
        <li
          key={item.name}
          className="flex min-w-0 items-baseline justify-between gap-3"
          title={item.name}
        >
          <span className="min-w-0 truncate text-muted-foreground">{item.name}</span>
          <span className="shrink-0 text-xs font-semibold">
            {item.count} {unit}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Statistik ringkas: EO terbanyak, event per bulan, venue terpadat, dan beban PIC (event ACTIVE saja). */
export function EventStatistics({ insights }: { insights: EventInsights }) {
  const maxMonth = Math.max(...insights.perMonth.map((m) => m.count), 1)
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Statistik">
      <article className="card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          EO terbanyak
        </h2>
        {insights.eoRanking.length > 0 ? (
          <CountList items={insights.eoRanking} unit="event" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada data.</p>
        )}
      </article>
      <article className="card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Event per bulan
        </h2>
        {insights.perMonth.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {insights.perMonth.map((month) => (
              <li key={month.month} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-muted-foreground">{formatMonth(month.month)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((month.count / maxMonth) * 100)}%` }}
                  />
                </span>
                <span className="shrink-0 text-xs font-semibold">
                  {month.count}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada data.</p>
        )}
      </article>
      <article className="card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Venue terpadat
        </h2>
        {insights.venueRanking.length > 0 ? (
          <CountList items={insights.venueRanking} unit="event" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada data.</p>
        )}
      </article>
      <article className="card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          PIC dengan event terbanyak
        </h2>
        {insights.picLoad.length > 0 ? (
          <CountList items={insights.picLoad.slice(0, 5)} unit="event" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada data.</p>
        )}
      </article>
    </section>
  )
}
