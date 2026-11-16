// Kalender venue activity untuk dashboard: untuk satu venue, empat minggu mulai dari tanggal
// pilihan. Bawaan dinamis: 1 minggu lalu, minggu ini, 2 minggu ke depan — hari ini SELALU di baris
// kedua (`calendarStart`); event lampau bisa dilihat dengan memilih tanggal mulai lain.
// Sebuah hari berwarna bila ≥2 event pada venue itu sama-sama berlangsung hari itu. Dua mode:
//   - SAME_HALL (bawaan): event juga harus memakai hall yang sama (teks hall exhibitor).
//   - ANY_HALL: hall diabaikan — semua event di venue itu dihitung, termasuk yang halnya kosong.
// Intensitas = jumlah event terbanyak yang beririsan pada hari itu (per hall di SAME_HALL).
// Murni: tanpa I/O, tanpa import lintas lapisan.

import type {
  VenueCalendar,
  VenueCalendarDay,
  VenueScheduleEvent,
  VenueSummary,
} from '@/domain/event/types'

export type VenueOverlapMode = 'SAME_HALL' | 'ANY_HALL'

export const CALENDAR_WEEKS = 4
const DAYS_PER_WEEK = 7
// Maksimum level warna (0 = tidak beririsan). 4 event berbagi hall = level 3; ≥5 = level 4.
export const MAX_OVERLAP_LEVEL = 4

const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

// Tanggal ISO + N hari (aritmetika UTC pada tanggal-saja).
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Senin pada atau sebelum tanggal ISO ini (awal minggu Senin–Minggu). */
export function mondayOf(date: string): string {
  const sinceMonday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(date, -sinceMonday)
}

/** Awal kalender bawaan: Senin minggu ini dikurangi 7 hari — hari ini jatuh di baris kedua. */
export function calendarStart(today: string): string {
  return addDays(mondayOf(today), -DAYS_PER_WEEK)
}

// Hall diketik bebas per exhibitor ("C1", "Hall C1", "hall  c1"). Kunci pembanding: huruf besar,
// spasi dirapikan, awalan kata "HALL" dibuang — agar ejaan berbeda untuk hall yang sama bertemu.
function hallKey(hall: string): string {
  return hall
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^HALL(?![A-Z])\s*/, '')
}

// Hall satu event: kunci → teks pertama yang ditemui (dipakai sebagai label).
function hallsOf(event: VenueScheduleEvent): Map<string, string> {
  const halls = new Map<string, string>()
  for (const hall of event.halls) {
    const key = hall ? hallKey(hall) : ''
    if (key && !halls.has(key)) halls.set(key, hall!.trim())
  }
  return halls
}

/** Daftar venue yang punya event (untuk pilihan venue): terbanyak event dulu, lalu nama. */
export function listVenues(events: readonly VenueScheduleEvent[]): VenueSummary[] {
  const venues = new Map<string, VenueSummary>()
  for (const event of events) {
    if (!event.venueId) continue
    const venue = venues.get(event.venueId)
    if (venue) venue.eventCount += 1
    else venues.set(event.venueId, { venueId: event.venueId, venueName: event.venueName, eventCount: 1 })
  }
  return [...venues.values()].sort(
    (a, b) => b.eventCount - a.eventCount || collator.compare(a.venueName, b.venueName),
  )
}

/**
 * Kalender satu venue untuk 28 hari yang dimulai pada Senin minggu `from`. Event tanpa tanggal
 * atau di venue lain diabaikan; pada SAME_HALL event tanpa hall juga tidak beririsan (hall tak
 * diketahui ≠ hall sama). Venue tanpa irisan tetap menghasilkan kalender (semua hari level 0).
 */
export function buildVenueCalendar(
  events: readonly VenueScheduleEvent[],
  venueId: string,
  from: string,
  mode: VenueOverlapMode = 'SAME_HALL',
): VenueCalendar {
  const startsOn = mondayOf(from)
  const totalDays = CALENDAR_WEEKS * DAYS_PER_WEEK

  const members = events
    .filter(
      (event): event is VenueScheduleEvent & { startsOn: string; endsOn: string } =>
        event.venueId === venueId && event.startsOn !== null && event.endsOn !== null,
    )
    .map((event) => ({ ...event, hallMap: hallsOf(event) }))
    .filter((event) => mode === 'ANY_HALL' || event.hallMap.size > 0)

  const sharedHalls = new Map<string, string>()
  const days: VenueCalendarDay[] = []
  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = addDays(startsOn, offset)
    // Kelompok → event yang berlangsung hari ini di kelompok itu.
    const perGroup = new Map<
      string,
      { label: string | null; events: { id: string; name: string }[] }
    >()
    for (const event of members) {
      if (event.startsOn > date || event.endsOn < date) continue
      // ANY_HALL: satu kelompok per venue (kunci kosong, tanpa label hall).
      const keyed: Iterable<[string, string | null]> =
        mode === 'ANY_HALL' ? [['', null]] : event.hallMap
      for (const [key, label] of keyed) {
        const entry = perGroup.get(key) ?? { label, events: [] }
        entry.events.push({ id: event.id, name: event.name })
        perGroup.set(key, entry)
      }
    }
    const groups = [...perGroup.entries()]
      .filter(([, entry]) => entry.events.length >= 2)
      .map(([key, entry]) => {
        if (entry.label !== null && !sharedHalls.has(key)) sharedHalls.set(key, entry.label)
        return { hall: entry.label, events: entry.events }
      })
      .sort(
        (a, b) =>
          b.events.length - a.events.length || collator.compare(a.hall ?? '', b.hall ?? ''),
      )
    const overlapCount = groups.reduce((max, group) => Math.max(max, group.events.length), 0)
    days.push({
      date,
      overlapCount,
      level: (overlapCount < 2
        ? 0
        : Math.min(overlapCount - 1, MAX_OVERLAP_LEVEL)) as VenueCalendarDay['level'],
      groups,
    })
  }

  return { startsOn, endsOn: days[days.length - 1].date, sharedHalls: [...sharedHalls.values()].sort(collator.compare), days }
}
