import assert from 'node:assert/strict'

import { cancelEventSchema, eventInputSchema, validateEventReferences } from './validation'

const venueId = 'b3d6e4c5-1457-4a67-bbad-23778d112240'
const eventOrganizerId = '2a17e637-2c0e-4d43-9e55-85f46bf520f9'
const picId = '9f1c3a2b-6d4e-4f5a-8b7c-0e1d2f3a4b5c'

// Event valid: seluruh referensi UUID, rentang tanggal sah, alias ter-trim dipertahankan.
const valid = eventInputSchema.safeParse({
  name: 'Vissasa Expo',
  alias: '  Vissasa  ',
  venueId,
  eventOrganizerId,
  picId,
  startsOn: '2026-10-01',
  endsOn: '2026-10-03',
})
assert.equal(valid.success, true)
assert.equal(valid.success && valid.data.alias, 'Vissasa')

// Nama kosong → pesan 'Nama event wajib diisi.' (Requirement 10.4).
const emptyName = eventInputSchema.safeParse({
  name: '   ',
  alias: null,
  venueId,
  eventOrganizerId,
  picId,
  startsOn: '2026-10-01',
  endsOn: '2026-10-03',
})
assert.equal(emptyName.success, false)
assert.equal(
  !emptyName.success && emptyName.error.issues.some((i) => i.message === 'Nama event wajib diisi.'),
  true,
)

// Nama >200 karakter → pesan yang sama 'Nama event wajib diisi.' (Requirement 10.4).
const longName = eventInputSchema.safeParse({
  name: 'x'.repeat(201),
  alias: null,
  venueId,
  eventOrganizerId,
  picId,
  startsOn: '2026-10-01',
  endsOn: '2026-10-03',
})
assert.equal(longName.success, false)
assert.equal(
  !longName.success && longName.error.issues.some((i) => i.message === 'Nama event wajib diisi.'),
  true,
)

// endsOn < startsOn → pesan tanggal pada path ['endsOn'] (Requirement 10.5 / 11.3).
const badRange = eventInputSchema.safeParse({
  name: 'Vissasa Expo',
  alias: null,
  venueId,
  eventOrganizerId,
  picId,
  startsOn: '2026-10-03',
  endsOn: '2026-10-01',
})
assert.equal(badRange.success, false)
assert.equal(
  !badRange.success &&
    badRange.error.issues.some(
      (i) =>
        i.path[0] === 'endsOn' &&
        i.message === 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.',
    ),
  true,
)

// alias kosong-setelah-trim dinormalkan ke null (Requirement 10.2/10.3).
const blankAlias = eventInputSchema.safeParse({
  name: 'Vissasa Expo',
  alias: '   ',
  venueId,
  eventOrganizerId,
  picId,
  startsOn: '2026-10-01',
  endsOn: '2026-10-03',
})
assert.equal(blankAlias.success, true)
assert.equal(blankAlias.success && blankAlias.data.alias, null)

// Referensi non-UUID ditolak (Requirement 12.4).
assert.equal(
  eventInputSchema.safeParse({
    name: 'Vissasa Expo',
    alias: null,
    venueId: 'venue-jiexpo',
    eventOrganizerId,
    picId,
    startsOn: '2026-10-01',
    endsOn: '2026-10-03',
  }).success,
  false,
)

// cancelEventSchema: alasan kosong ditolak (Requirement 13.4), alasan sah diterima.
assert.equal(cancelEventSchema.safeParse({ reason: '   ' }).success, false)
assert.equal(cancelEventSchema.safeParse({ reason: 'Event dibatalkan oleh EO.' }).success, true)

// validateEventReferences: semua valid → ok(true).
const allValid = validateEventReferences({
  venueExists: true,
  eventOrganizerExists: true,
  picExists: true,
})
assert.equal(allValid.ok, true)
assert.equal(allValid.ok && allValid.value, true)

// validateEventReferences: mengumpulkan SEMUA referensi tidak valid, bukan berhenti di yang pertama.
const allInvalid = validateEventReferences({
  venueExists: false,
  eventOrganizerExists: false,
  picExists: false,
})
assert.equal(allInvalid.ok, false)
assert.equal(!allInvalid.ok && allInvalid.issues.length, 3)
assert.equal(
  !allInvalid.ok && allInvalid.issues.map((i) => i.path).join(','),
  'venueId,eventOrganizerId,picId',
)

console.log('event domain validation passed')

// ── Keputusan 2026-10-29: semua field opsional kecuali nama ──────────────────────────────────

// Hanya nama → valid; referensi & tanggal kosong dinormalisasi ke null.
const nameOnly = eventInputSchema.safeParse({ name: 'Event Baru' })
assert.equal(nameOnly.success, true)
assert.equal(
  nameOnly.success &&
    nameOnly.data.venueId === null &&
    nameOnly.data.eventOrganizerId === null &&
    nameOnly.data.picId === null &&
    nameOnly.data.startsOn === null &&
    nameOnly.data.endsOn === null &&
    nameOnly.data.moveInOn === null &&
    nameOnly.data.moveOutOn === null,
  true,
)

// String kosong dari form dinormalisasi ke null (bukan ditolak).
const emptyStrings = eventInputSchema.safeParse({
  name: 'Event Baru',
  venueId: '',
  eventOrganizerId: '',
  picId: '',
  startsOn: '',
  endsOn: '',
  moveInOn: '',
  moveOutOn: '',
})
assert.equal(emptyStrings.success, true)
assert.equal(emptyStrings.success && emptyStrings.data.picId, null)

// Format UUID tetap ditegakkan BILA diisi — '' lolos, string non-UUID ditolak.
assert.equal(
  eventInputSchema.safeParse({ name: 'E', venueId: 'venue-jiexpo' }).success,
  false,
)

// Aturan antar-field hanya aktif bila KEDUA tanggal terisi: hanya startsOn → valid.
assert.equal(
  eventInputSchema.safeParse({ name: 'E', startsOn: '2026-10-03' }).success,
  true,
)

// Move out sebelum move in ditolak bila keduanya terisi (I-7).
const badMove = eventInputSchema.safeParse({
  name: 'E',
  moveInOn: '2026-10-05',
  moveOutOn: '2026-10-04',
})
assert.equal(badMove.success, false)
assert.equal(
  !badMove.success &&
    badMove.error.issues.some(
      (i) => i.path[0] === 'moveOutOn' && i.message === 'Tanggal move out tidak boleh sebelum move in.',
    ),
  true,
)

console.log('event optional-fields validation passed')
