'use client'

// Seksi "Venue activity" dashboard: kalender 4 minggu untuk SATU venue yang dipilih dari daftar di
// sisi kanan (bawaan: Jakarta International Expo / Jiexpo). Bawaan jendela: 1 minggu lalu, minggu
// ini, 2 minggu ke depan (hari ini di baris kedua); filter "Mulai dari" menggesernya, termasuk ke
// event yang sudah selesai. Hari berwarna = ≥2 pameran beririsan; makin banyak, makin pekat
// (gradasi hijau gaya aktivitas GitHub). Bawaan: pameran harus memakai hall yang sama; toggle
// "Abaikan hall" menghitung semua pameran di venue itu. Klien hanya karena pilihan/filter;
// penghitungan murni ada di `domain/event/venue-calendar.ts`.

import { useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'

import type { VenueCalendar, VenueCalendarDay, VenueScheduleEvent } from '@/domain/event/types'
import {
  buildVenueCalendar,
  calendarStart,
  listVenues,
  mondayOf,
} from '@/domain/event/venue-calendar'
import { formatDay, formatDayShort } from '@/features/events/components/event-presentation'

// Venue terpilih bawaan: Jakarta International Expo (Jiexpo).
const DEFAULT_VENUE = /jakarta international expo|jiexpo/i

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

// Palet aktivitas GitHub: level 0 (tidak beririsan) … 4 (paling banyak beririsan).
const LEVEL_CLASS: Record<VenueCalendarDay['level'], string> = {
  0: 'bg-[#ebedf0] text-slate-500',
  1: 'bg-[#9be9a8] text-slate-800',
  2: 'bg-[#40c463] text-slate-900',
  3: 'bg-[#30a14e] text-white',
  4: 'bg-[#216e39] text-white',
}

function dayLabel(day: VenueCalendarDay): string {
  const date = formatDay(day.date)
  if (day.level === 0) return `${date} · tidak ada pameran yang beririsan`
  const groups = day.groups
    .map((group) => {
      const names = group.events.map((event) => event.name).join(', ')
      return group.hall === null ? names : `Hall ${group.hall}: ${names}`
    })
    .join(' | ')
  const shared = day.groups[0]?.hall === null ? 'pameran beririsan' : 'pameran berbagi hall'
  return `${date} · ${day.overlapCount} ${shared} · ${groups}`
}

function Legend() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-hidden="true">
      <span>Sedikit</span>
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <span key={level} className={`size-3.5 rounded-sm ${LEVEL_CLASS[level]}`} />
      ))}
      <span>Banyak</span>
    </div>
  )
}

function VenueCalendarView({
  venueName,
  calendar,
  today,
  ignoreHall,
}: {
  venueName: string
  calendar: VenueCalendar
  today: string
  ignoreHall: boolean
}) {
  const weeks = [0, 1, 2, 3].map((week) => calendar.days.slice(week * 7, week * 7 + 7))
  const hallNote = ignoreHall
    ? 'Semua hall'
    : calendar.sharedHalls.length > 0
      ? `Hall sama: ${calendar.sharedHalls.join(', ')}`
      : ''
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-border p-4">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-medium" title={venueName}>
          {venueName}
        </p>
        {hallNote ? (
          <p
            className="max-w-[55%] shrink-0 truncate text-xs text-muted-foreground"
            title={hallNote}
          >
            {hallNote}
          </p>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-7 items-center gap-1">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {weekday}
          </span>
        ))}
        {weeks.map((days) => (
          <div key={days[0].date} className="contents">
            {days.map((day) => (
              <span
                key={day.date}
                role="img"
                aria-label={dayLabel(day)}
                title={dayLabel(day)}
                className={`flex h-8 items-center justify-center rounded-md text-[11px] tabular-nums ${LEVEL_CLASS[day.level]} ${
                  day.date === today ? 'ring-2 ring-orange-600 ring-offset-1' : ''
                }`}
              >
                {Number(day.date.slice(8))}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardVenueActivity({
  today,
  events,
}: {
  today: string
  events: VenueScheduleEvent[]
}) {
  const defaultStart = calendarStart(today)
  const venues = useMemo(() => listVenues(events), [events])
  const [startsOn, setStartsOn] = useState(defaultStart)
  const [ignoreHall, setIgnoreHall] = useState(false)
  const [venueId, setVenueId] = useState<string | null>(
    () =>
      (venues.find((venue) => DEFAULT_VENUE.test(venue.venueName)) ?? venues[0])?.venueId ?? null,
  )
  const venue = venues.find((item) => item.venueId === venueId) ?? null
  const calendar = useMemo(
    () =>
      venueId === null
        ? null
        : buildVenueCalendar(events, venueId, startsOn, ignoreHall ? 'ANY_HALL' : 'SAME_HALL'),
    [events, venueId, startsOn, ignoreHall],
  )
  const hasActivity = calendar?.days.some((day) => day.level > 0) ?? false

  return (
    <section id="venue" className="card p-5 sm:p-6" aria-label="Venue activity">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <MapPin size={18} className="text-foreground" aria-hidden="true" />
          Venue activity
        </h2>
        <Legend />
      </div>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Kalender aktivitas venue. Gradasi warna menunjukkan kadar aktivitas venue.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-2">
          Mulai dari
          <input
            type="date"
            value={startsOn}
            onChange={(event) => {
              if (event.target.value) setStartsOn(mondayOf(event.target.value))
            }}
            className="rounded-lg border border-border bg-white px-2 py-1 text-sm"
          />
        </label>
        {startsOn !== defaultStart ? (
          <button
            type="button"
            onClick={() => setStartsOn(defaultStart)}
            className="text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            Kembali ke hari ini
          </button>
        ) : null}
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={ignoreHall}
            onChange={(event) => setIgnoreHall(event.target.checked)}
            className="h-4 w-4 accent-orange-600"
          />
          Abaikan hall
          <span className="text-muted-foreground">
            (hitung semua pameran di venue yang sama, termasuk yang hall-nya belum diisi)
          </span>
        </label>
      </div>

      {venue === null || calendar === null ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Belum ada pameran dengan venue.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row">
            <VenueCalendarView
              venueName={venue.venueName || 'Venue tanpa nama'}
              calendar={calendar}
              today={today}
              ignoreHall={ignoreHall}
            />
            {/* Tinggi daftar = tinggi kalender (lg: mengisi penuh kolom, isi digulir); di layar sempit dibatasi. */}
            <nav
              aria-label="Pilih venue"
              className="flex max-h-72 flex-col lg:relative lg:max-h-none lg:w-72 lg:shrink-0"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Venue
              </p>
              <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1 lg:absolute lg:inset-x-0 lg:bottom-0 lg:top-6">
                {venues.map((item) => {
                  const selected = item.venueId === venueId
                  return (
                    <li key={item.venueId}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setVenueId(item.venueId)}
                        className={`flex w-full min-w-0 items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? 'bg-orange-600 font-medium text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="min-w-0 truncate" title={item.venueName}>
                          {item.venueName || 'Venue tanpa nama'}
                        </span>
                        <span
                          className={`shrink-0 text-xs tabular-nums ${
                            selected ? 'text-orange-100' : 'text-muted-foreground'
                          }`}
                        >
                          {item.eventCount} event
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>
          {!hasActivity ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {ignoreHall
                ? 'Tidak ada pameran yang berlangsung bersamaan di venue ini pada '
                : 'Tidak ada pameran yang berbagi hall di venue ini pada '}
              {formatDayShort(calendar.startsOn)} – {formatDayShort(calendar.endsOn)}.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
