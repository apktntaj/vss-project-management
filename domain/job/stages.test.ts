import assert from 'node:assert/strict'

import type { BarisBarang } from '@/domain/exhibition/cipl-document'
import {
  expectedDerivedStages,
  stageCiplLines,
  stageForNewJob,
  stageReconciliation,
} from './stages'
import type { JobCiplLine } from './types'

const item = (disposisi: BarisBarang['disposisi'], refKoliIds: string[] = []): BarisBarang => ({
  uraian: 'Barang',
  merekModel: null,
  kodeHs: null,
  jumlah: 1,
  satuan: 'PCS',
  nilaiSatuan: null,
  nilaiTotal: null,
  disposisi,
  refKoli: null,
  refKoliIds,
})
const pk = (id: string) => ({ id, label: id, dimension: null, volumeCbm: 1, weightKg: 10 })
const line = (overrides: Partial<JobCiplLine>): JobCiplLine => ({
  id: 'l1',
  exhibitorId: null,
  exhibitor: null,
  nameOnDocument: 'ALPHA',
  koli: { totalCount: 0, bareCaseCount: null, details: [] },
  items: [],
  notes: [],
  ...overrides,
})

// Tahap yang diharapkan dari disposisi: tanpa item = tidak ada; TIDAK_DISEBUT dihitung re-ekspor.
assert.deepEqual(expectedDerivedStages([line({})]), [])
assert.deepEqual(expectedDerivedStages([line({ items: [item('TIDAK_DISEBUT')] })]), ['RE_EXPORT'])
assert.deepEqual(
  expectedDerivedStages([line({ items: [item('RE_EXPORT'), item('GIVE_AWAY')] })]),
  ['DISPOSAL', 'RE_EXPORT'],
)

// Baris campuran: k1 dirujuk item re-ekspor, k2 hanya item disposal, k3 tak dirujuk.
const mixed = line({
  koli: {
    totalCount: 3,
    bareCaseCount: null,
    totalWeightKg: 30,
    details: [pk('k1'), pk('k2'), pk('k3')],
  },
  items: [item('RE_EXPORT', ['k1']), item('DISPOSED', ['k2'])],
})
const [reExport] = stageCiplLines([mixed], 'RE_EXPORT')
assert.deepEqual(reExport.koli.details.map((koli) => koli.id), ['k1', 'k3'])
assert.equal(reExport.koli.totalCount, 2)
assert.equal(reExport.koli.totalWeightKg, undefined)
assert.equal(reExport.items.length, 1)
const [disposal] = stageCiplLines([mixed], 'DISPOSAL')
assert.deepEqual(disposal.koli.details.map((koli) => koli.id), ['k2'])
assert.equal(disposal.koli.totalCount, 1)
assert.equal(disposal.items.length, 1)

// Semua item disposal: seluruh koli ke DISPOSAL, hilang dari RE_EXPORT.
const allDisposal = line({
  koli: { totalCount: 2, bareCaseCount: null, details: [pk('a'), pk('b')] },
  items: [item('DISPOSED', ['a']), item('GIVE_AWAY', ['b'])],
})
assert.deepEqual(stageCiplLines([allDisposal], 'RE_EXPORT'), [])
assert.equal(stageCiplLines([allDisposal], 'DISPOSAL')[0].koli.totalCount, 2)

// Baris tanpa item: utuh di RE_EXPORT, tidak di DISPOSAL.
const noItems = line({ koli: { totalCount: 1, bareCaseCount: null, details: [pk('z')] } })
assert.deepEqual(stageCiplLines([noItems], 'RE_EXPORT'), [noItems])
assert.deepEqual(stageCiplLines([noItems], 'DISPOSAL'), [])

// Selisih CIPL vs job turunan aktif.
const reExportOnly = [line({ items: [item('RE_EXPORT')] })]
assert.deepEqual(stageReconciliation(reExportOnly, []), [{ stage: 'RE_EXPORT', kind: 'MISSING' }])
assert.deepEqual(stageReconciliation(reExportOnly, ['RE_EXPORT', 'DISPOSAL']), [
  { stage: 'DISPOSAL', kind: 'UNEXPECTED' },
])
assert.deepEqual(stageReconciliation([line({})], ['DISPOSAL']), [])

// Tahap job baru: hanya international non-road yang bertahap.
assert.equal(stageForNewJob('INTERNATIONAL', 'TPPB_BC_23'), 'INBOUND')
assert.equal(stageForNewJob('INTERNATIONAL', 'ROAD_SHIPMENT'), null)
assert.equal(stageForNewJob('LOCAL', null), null)

console.log('job stages passed')
