import { expect, test } from 'bun:test'

import {
  referenceEventOrganizerInputSchema,
  referenceVenueInputSchema,
} from './validation'
import type { EventInput, EventOrganizerRecord, VenueRecord } from './types'

// Mengapa file ini: memverifikasi invariant master data inline (Requirement 12.2/12.4) di level
// domain murni — tanpa DB. Dua hal yang diuji: (1) `legalName` kosong/spasi ditolak skema (yang
// menjadi 400 di batas route), dan (2) record yang terbuat dirujuk event LEWAT ID, bukan dengan
// menggandakan nilai nama. Didaftarkan ke script `domain:test` di package.json agar benar-benar
// dieksekusi (konvensi proyek).

test('referenceVenueInputSchema menolak legalName kosong', () => {
  const result = referenceVenueInputSchema.safeParse({ legalName: '', aliasName: null, city: null })
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.issues.some((i) => i.message === 'Nama venue wajib diisi.')).toBe(true)
  }
})

test('referenceVenueInputSchema menolak legalName hanya-spasi', () => {
  const result = referenceVenueInputSchema.safeParse({
    legalName: '    ',
    aliasName: null,
    city: null,
  })
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.issues.some((i) => i.message === 'Nama venue wajib diisi.')).toBe(true)
  }
})

test('referenceVenueInputSchema menerima nama valid dan menormalkan alias/city kosong ke null', () => {
  const result = referenceVenueInputSchema.safeParse({
    legalName: '  JIExpo Kemayoran  ',
    aliasName: '   ',
    city: '  Jakarta  ',
  })
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.legalName).toBe('JIExpo Kemayoran')
    expect(result.data.aliasName).toBeNull()
    expect(result.data.city).toBe('Jakarta')
  }
})

test('referenceEventOrganizerInputSchema menolak legalName kosong/spasi', () => {
  expect(referenceEventOrganizerInputSchema.safeParse({ legalName: '' }).success).toBe(false)
  const spaces = referenceEventOrganizerInputSchema.safeParse({ legalName: '   ' })
  expect(spaces.success).toBe(false)
  if (!spaces.success) {
    expect(
      spaces.error.issues.some((i) => i.message === 'Nama event organizer wajib diisi.'),
    ).toBe(true)
  }
})

test('referenceEventOrganizerInputSchema menerima nama valid', () => {
  const result = referenceEventOrganizerInputSchema.safeParse({ legalName: 'PT Dyandra' })
  expect(result.success).toBe(true)
  if (result.success) expect(result.data.legalName).toBe('PT Dyandra')
})

// Create-inline lalu event merujuk lewat FK id (Req 12.2/12.3): sebuah record yang baru terbuat
// memberi id, dan event memakai id itu sebagai venueId/eventOrganizerId — BUKAN menggandakan nama.
test('record master data dirujuk event lewat id, bukan nilai yang digandakan', () => {
  const venue: VenueRecord = {
    id: 'b3d6e4c5-1457-4a67-bbad-23778d112240',
    legalName: 'JIExpo Kemayoran',
    aliasName: null,
    city: 'Jakarta',
  }
  const organizer: EventOrganizerRecord = {
    id: '2a17e637-2c0e-4d43-9e55-85f46bf520f9',
    legalName: 'PT Dyandra',
  }

  const event: Pick<EventInput, 'venueId' | 'eventOrganizerId'> = {
    venueId: venue.id,
    eventOrganizerId: organizer.id,
  }

  // Event memegang id referensi, bukan nama.
  expect(event.venueId).toBe(venue.id)
  expect(event.eventOrganizerId).toBe(organizer.id)
  expect(event.venueId).not.toBe(venue.legalName)
  expect(event.eventOrganizerId).not.toBe(organizer.legalName)
})
