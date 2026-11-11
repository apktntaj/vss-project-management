import assert from 'node:assert/strict'

import type { VenueTppbProfile } from '@/domain/event/types'
import type { Exhibitor } from '@/domain/exhibitor/types'
import type { BarisBarang } from '@/domain/exhibition/cipl-document'
import type { Job, JobCiplLine } from '@/domain/job/types'
import type { KanwilEventInfo } from './kanwil-letter'
import { buildTppbGoodsForm, missingTppbGoodsFormFields } from './tppb-goods-form'

const item = (overrides: Partial<BarisBarang>): BarisBarang => ({
  uraian: 'Barang',
  merekModel: null,
  kodeHs: null,
  jumlah: 1,
  satuan: 'PCS',
  nilaiSatuan: 10,
  nilaiTotal: 10,
  disposisi: 'TIDAK_DISEBUT',
  refKoli: null,
  refKoliIds: [],
  ...overrides,
})
const line = (overrides: Partial<JobCiplLine>): JobCiplLine =>
  ({ id: 'l', exhibitorId: null, exhibitor: null, nameOnDocument: 'X', koli: null, items: [], notes: [], ...overrides }) as JobCiplLine

const job = {
  ciplDocument: { mataUang: 'USD' },
  ciplLines: [
    line({
      exhibitorId: 'x-int',
      nameOnDocument: 'Intl Doc Name',
      items: [item({ uraian: 'Mug', merekModel: 'Steel', jumlah: 24, nilaiSatuan: 21.4 }), item({ uraian: 'Fan' })],
    }),
    line({ exhibitorId: 'x-loc', nameOnDocument: 'Lokal Doc', items: [item({ uraian: 'Pump', nilaiSatuan: null })] }),
    line({ nameOnDocument: 'Belum Tertaut', items: [item({ uraian: 'Cable' })] }),
    line({ exhibitorId: 'x-loc', items: [] }),
  ],
} as unknown as Job

const exhibitors = new Map<string, Exhibitor>([
  ['x-int', { id: 'x-int', kind: 'INTERNATIONAL', name: 'Intl Exhibitor', npwp: null } as Exhibitor],
  ['x-loc', { id: 'x-loc', kind: 'LOCAL', name: 'PT Lokal', npwp: '01.234' } as Exhibitor],
])

const event: KanwilEventInfo = {
  name: '13th International Mine Ventilation Congress',
  alias: 'IMVC 2026',
  organizerName: 'EO',
  startsOn: '2026-11-09',
  endsOn: '2026-11-13',
}
const venue: VenueTppbProfile = {
  venueName: 'V',
  city: null,
  operatorName: 'PT. Indonesia International Expo',
  operatorNpwp: '01.000',
  operatorAddress: 'Alamat',
  customsRegionalOffice: null,
  signatories: [],
}

const form = buildTppbGoodsForm(event, venue, job, exhibitors)
assert.deepEqual(form.rows.map((row) => row.no), [1, 2, 3, 4])
assert.equal(form.rows[0].description, 'Mug - Steel')
assert.equal(form.rows[1].description, 'Fan')
assert.deepEqual(form.rows.map((row) => row.taxStatus), ['SPLN', 'SPLN', 'SPDN', '-'])
assert.deepEqual(form.rows.map((row) => row.npwp), ['-', '-', '01.234', '-'])
assert.equal(form.rows[2].unitValue, null)
assert.equal(form.rows[0].unitValue, 21.4)
assert.equal(form.rows[3].owner, 'Belum Tertaut')
assert.equal(form.rows[0].owner, 'Intl Exhibitor')
assert.equal(form.exhibitionTitle, 'IMVC 2026 (13th International Mine Ventilation Congress)')
assert.equal(buildTppbGoodsForm({ ...event, alias: null }, venue, job, exhibitors).exhibitionTitle, event.name)
assert.equal(form.period, '09 - 13 November 2026')
assert.equal(form.currency, 'USD')

assert.deepEqual(missingTppbGoodsFormFields(event, venue), [])
assert.deepEqual(missingTppbGoodsFormFields(event, { ...venue, operatorNpwp: null, operatorAddress: '' }), [
  'NPWP pengusaha TPPB (Settings → Venue)',
  'alamat pengusaha TPPB (Settings → Venue)',
])

console.log('tppb goods form passed')
