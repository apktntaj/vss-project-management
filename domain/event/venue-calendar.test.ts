import { describe, expect, test } from 'bun:test'

import type { VenueScheduleEvent } from '@/domain/event/types'
import {
  buildVenueCalendar,
  calendarStart,
  listVenues,
  mondayOf,
} from '@/domain/event/venue-calendar'

// 2026-11-18 = Rabu → Senin minggu ini 16 Nov → kalender mulai Senin 9 Nov, berakhir Minggu 6 Des.
const TODAY = '2026-11-18'
const START = calendarStart(TODAY)
const JIEXPO = 'venue-jiexpo'

function event(overrides: Partial<VenueScheduleEvent> & { id: string }): VenueScheduleEvent {
  return {
    name: overrides.id,
    startsOn: '2026-11-17',
    endsOn: '2026-11-20',
    venueId: JIEXPO,
    venueName: 'Jakarta International Expo',
    halls: ['C1'],
    ...overrides,
  }
}

const calendarOf = (
  events: VenueScheduleEvent[],
  mode?: 'SAME_HALL' | 'ANY_HALL',
  from = START,
  venueId = JIEXPO,
) => buildVenueCalendar(events, venueId, from, mode)
const dayOf = (calendar: ReturnType<typeof calendarOf>, date: string) =>
  calendar.days.find((day) => day.date === date)!

describe('calendarStart', () => {
  test('hari ini selalu di baris kedua, apa pun harinya', () => {
    for (const today of ['2026-11-16', '2026-11-18', '2026-11-22', '2026-11-23', '2027-01-01']) {
      const start = calendarStart(today)
      const offset = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
      expect(new Date(`${start}T00:00:00Z`).getUTCDay()).toBe(1) // Senin
      expect(offset).toBeGreaterThanOrEqual(7)
      expect(offset).toBeLessThanOrEqual(13)
    }
    expect(calendarStart(TODAY)).toBe('2026-11-09')
  })
})

describe('buildVenueCalendar', () => {
  test('hari berwarna hanya saat dua event berbagi venue DAN hall yang sama', () => {
    const calendar = calendarOf([
      event({ id: 'a' }),
      event({ id: 'b', startsOn: '2026-11-19', endsOn: '2026-11-25', halls: ['hall c1'] }),
    ])

    expect(calendar.startsOn).toBe('2026-11-09')
    expect(calendar.endsOn).toBe('2026-12-06')
    expect(calendar.days).toHaveLength(28)
    expect(calendar.sharedHalls).toEqual(['C1'])
    expect(dayOf(calendar, '2026-11-18').level).toBe(0) // hanya event a
    expect(dayOf(calendar, '2026-11-19')).toMatchObject({ level: 1, overlapCount: 2 })
    expect(dayOf(calendar, '2026-11-20').groups[0].events.map((item) => item.id)).toEqual(['a', 'b'])
    expect(dayOf(calendar, '2026-11-21').level).toBe(0) // hanya event b
  })

  test('hall berbeda, hall kosong, atau venue lain tidak berwarna; kalender tetap 28 hari', () => {
    const calendar = calendarOf([
      event({ id: 'a' }),
      event({ id: 'b', halls: ['B3'] }),
      event({ id: 'c', halls: [null, ' '] }),
      event({ id: 'd', venueId: 'venue-nice', venueName: 'NICE' }),
    ])

    expect(calendar.days).toHaveLength(28)
    expect(calendar.days.every((day) => day.level === 0)).toBe(true)
    expect(calendar.sharedHalls).toEqual([])
  })

  test('intensitas naik dengan jumlah event yang berbagi hall, maksimum level 4', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => event({ id }))

    expect(dayOf(calendarOf(six), '2026-11-18')).toMatchObject({ overlapCount: 6, level: 4 })
    expect(dayOf(calendarOf(six.slice(0, 3)), '2026-11-18').level).toBe(2)
  })

  test('ANY_HALL: hall berbeda atau kosong tetap dihitung selama venue sama', () => {
    const calendar = calendarOf(
      [
        event({ id: 'a' }),
        event({ id: 'b', halls: ['B3'] }),
        event({ id: 'c', halls: [null] }),
        event({ id: 'd', venueId: 'venue-nice', venueName: 'NICE' }),
      ],
      'ANY_HALL',
    )

    expect(calendar.sharedHalls).toEqual([])
    expect(dayOf(calendar, '2026-11-18')).toMatchObject({ overlapCount: 3, level: 2 })
    expect(dayOf(calendar, '2026-11-18').groups).toHaveLength(1)
    expect(dayOf(calendar, '2026-11-18').groups[0].hall).toBeNull()
    expect(dayOf(calendar, '2026-11-21').level).toBe(0)
  })

  test('tanggal mulai bebas: jendela jatuh ke Senin minggu tanggal itu dan menjangkau masa lalu', () => {
    const past = [
      event({ id: 'a', startsOn: '2026-08-04', endsOn: '2026-08-07' }),
      event({ id: 'b', startsOn: '2026-08-05', endsOn: '2026-08-09' }),
    ]

    expect(mondayOf('2026-08-05')).toBe('2026-08-03')
    expect(calendarOf(past).days.every((day) => day.level === 0)).toBe(true)
    const calendar = calendarOf(past, 'SAME_HALL', '2026-08-05')
    expect(calendar.startsOn).toBe('2026-08-03')
    expect(calendar.endsOn).toBe('2026-08-30')
    expect(dayOf(calendar, '2026-08-05').level).toBe(1)
    expect(dayOf(calendar, '2026-08-08').level).toBe(0)
  })
})

describe('listVenues', () => {
  test('venue terbanyak event dulu, lalu nama; event tanpa venue diabaikan', () => {
    const venues = listVenues([
      event({ id: 'a', venueId: 'v-b', venueName: 'Venue B' }),
      event({ id: 'b', venueId: 'v-a', venueName: 'Venue A' }),
      event({ id: 'c', venueId: 'v-c', venueName: 'Venue C' }),
      event({ id: 'd', venueId: 'v-c', venueName: 'Venue C' }),
      event({ id: 'e', venueId: null, venueName: '' }),
    ])

    expect(venues).toEqual([
      { venueId: 'v-c', venueName: 'Venue C', eventCount: 2 },
      { venueId: 'v-a', venueName: 'Venue A', eventCount: 1 },
      { venueId: 'v-b', venueName: 'Venue B', eventCount: 1 },
    ])
  })
})
