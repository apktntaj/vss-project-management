import assert from 'node:assert/strict'

import {
  buildKanwilLetter,
  formatIdDateRange,
  kanwilLetterInputSchema,
  missingKanwilLetterFields,
  type KanwilEventInfo,
} from './kanwil-letter'
import type { VenueTppbProfile } from '@/domain/event/types'

// Empat bentuk rentang tanggal + varian form (separator " - ", hari 2 digit).
assert.equal(formatIdDateRange('2024-05-14', '2024-05-14'), '14 Mei 2024')
assert.equal(formatIdDateRange('2024-05-14', '2024-05-16'), '14 sampai dengan 16 Mei 2024')
assert.equal(formatIdDateRange('2026-10-28', '2026-11-02'), '28 Oktober sampai dengan 2 November 2026')
assert.equal(formatIdDateRange('2026-12-30', '2027-01-02'), '30 Desember 2026 sampai dengan 2 Januari 2027')
assert.equal(formatIdDateRange('2026-11-09', '2026-11-13', { separator: ' - ', padDay: true }), '09 - 13 November 2026')

const event: KanwilEventInfo = {
  name: 'The 48th IPA Convention & Exhibition 2024',
  alias: null,
  organizerName: 'PT. Dyandra Promosindo',
  startsOn: '2024-05-14',
  endsOn: '2024-05-16',
}
const venue: VenueTppbProfile = {
  venueName: 'ICE BSD',
  city: 'Tangerang',
  operatorName: 'PT. Indonesia International Expo',
  operatorNpwp: '01.000.000.0-000.000',
  operatorAddress: 'ICE BSD City',
  customsRegionalOffice: 'Banten',
  signatories: [{ name: 'E. Ernawan', title: 'Presiden Direktur' }],
}
const input = kanwilLetterInputSchema.parse({ letterNumber: '001/IIE/2024', letterDate: '2024-04-17', greeting: null })

const letter = buildKanwilLetter(event, venue, input)
assert.equal(letter.placeDate, 'Tangerang, 17 April 2024')
assert.equal(letter.recipient[3], 'Banten')
assert.equal(letter.paragraphs.length, 1)
assert.ok(letter.paragraphs[0].includes('yang diselenggarakan oleh PT. Dyandra Promosindo pada tanggal 14 sampai dengan 16 Mei 2024.'))

const greeted = buildKanwilLetter(event, venue, { ...input, greeting: 'Selamat Hari Raya' })
assert.equal(greeted.paragraphs[0], 'Selamat Hari Raya')
assert.equal(greeted.paragraphs.length, 2)

assert.equal(buildKanwilLetter(event, { ...venue, city: null }, input).placeDate, '17 April 2024')
assert.ok(!buildKanwilLetter({ ...event, organizerName: '' }, venue, input).paragraphs[0].includes('yang diselenggarakan oleh'))

assert.deepEqual(missingKanwilLetterFields(event, venue), [])
assert.deepEqual(
  missingKanwilLetterFields(
    { ...event, startsOn: null, endsOn: null },
    { ...venue, operatorName: ' ', customsRegionalOffice: null, signatories: [] },
  ),
  [
    'nama pengusaha TPPB (Settings → Venue)',
    'Kanwil DJBC tujuan (Settings → Venue)',
    'penandatangan (Settings → Venue)',
    'tanggal mulai & selesai event',
  ],
)

assert.deepEqual(kanwilLetterInputSchema.parse({ letterNumber: ' 001 ', letterDate: '2024-04-17', greeting: '  ' }), {
  letterNumber: '001',
  letterDate: '2024-04-17',
  greeting: null,
})
assert.throws(() => kanwilLetterInputSchema.parse({ letterNumber: '', letterDate: '2024-04-17' }))

console.log('kanwil letter passed')
