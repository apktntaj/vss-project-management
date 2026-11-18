import assert from 'node:assert/strict'

import type { BarisBarang } from '@/domain/exhibition/cipl-document'
import {
  expectedDerivedStages,
  keputusanDisposisiKoli,
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

// Tahap yang diharapkan dari disposisi menurut rezim: tanpa item = tidak ada; TIDAK_DISEBUT
// dihitung re-ekspor; ATA tidak punya disposal; Permanent Import tidak punya turunan.
assert.deepEqual(expectedDerivedStages([line({})], 'TPPB_BC_23'), [])
assert.deepEqual(expectedDerivedStages([line({ items: [item('TIDAK_DISEBUT')] })], 'TPPB_BC_23'), [
  'RE_EXPORT',
])
assert.deepEqual(
  expectedDerivedStages([line({ items: [item('RE_EXPORT'), item('GIVE_AWAY')] })], 'TPPB_BC_23'),
  ['DISPOSAL', 'RE_EXPORT'],
)
assert.deepEqual(
  expectedDerivedStages([line({ items: [item('RE_EXPORT'), item('DISPOSED')] })], 'ATA_CARNET'),
  ['RE_EXPORT'],
)
assert.deepEqual(
  expectedDerivedStages([line({ items: [item('RE_EXPORT'), item('DISPOSED')] })], 'PERMANENT_IMPORT'),
  [],
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

// Label rentang: koli "7-11" berisi barang disposal saja = 5 paket di DISPOSAL (bukan 1 baris),
// dan 5 itu dikurangkan dari RE_EXPORT. Koli campur ('mix') tetap di re-ekspor.
const range = line({
  koli: {
    totalCount: 7,
    bareCaseCount: null,
    details: [
      { id: 'r', label: '7-11', dimension: null, volumeCbm: 1, weightKg: 10 },
      { id: 'mix', label: '12', dimension: null, volumeCbm: 1, weightKg: 10 },
      { id: 'keep', label: '13', dimension: null, volumeCbm: 1, weightKg: 10 },
    ],
  },
  items: [item('DISPOSED', ['r']), item('DISPOSED', ['mix']), item('RE_EXPORT', ['mix']), item('RE_EXPORT', ['keep'])],
})
assert.equal(stageCiplLines([range], 'DISPOSAL')[0].koli.totalCount, 5)
assert.equal(stageCiplLines([range], 'RE_EXPORT')[0].koli.totalCount, 2)

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

// ---------------------------------------------------------------------------
// Keputusan disposisi per koli: manual menang; isi tunggal diturunkan; campuran perlu diputuskan.
// ---------------------------------------------------------------------------
const pkDisposisi = (id: string, disposisi: 'DISPOSAL' | 'RE_EXPORT') => ({ ...pk(id), disposisi })

const keputusanLine = line({
  koli: { totalCount: 4, bareCaseCount: null, details: [pk('k1'), pk('k2'), pk('k4')] },
  items: [
    item('DISPOSED', ['k1']),
    item('RE_EXPORT', ['k2']),
    item('DISPOSED', ['k4']),
    item('RE_EXPORT', ['k4']),
  ],
})
assert.deepEqual(keputusanDisposisiKoli(keputusanLine, pk('k1')), {
  keputusan: 'TURUNAN',
  disposisi: 'DISPOSAL',
  dari: 'ISI_KOLI',
})
assert.deepEqual(keputusanDisposisiKoli(keputusanLine, pk('k2')), {
  keputusan: 'TURUNAN',
  disposisi: 'RE_EXPORT',
  dari: 'ISI_KOLI',
})
// k4 dirujuk barang disposal DAN re-ekspor → tidak bisa diturunkan.
assert.deepEqual(keputusanDisposisiKoli(keputusanLine, pk('k4')), { keputusan: 'PERLU_DIPUTUSKAN' })
// Keputusan manual menang atas isi campuran.
assert.deepEqual(keputusanDisposisiKoli(keputusanLine, pkDisposisi('k4', 'DISPOSAL')), {
  keputusan: 'MANUAL',
  disposisi: 'DISPOSAL',
})
// k3 tak dirujuk barang mana pun → aturan baris (ada barang re-ekspor → re-ekspor).
assert.deepEqual(keputusanDisposisiKoli(keputusanLine, pk('k3')), {
  keputusan: 'TURUNAN',
  disposisi: 'RE_EXPORT',
  dari: 'BARIS',
})
assert.deepEqual(keputusanDisposisiKoli(noItems, noItems.koli.details[0]), {
  keputusan: 'TURUNAN',
  disposisi: 'RE_EXPORT',
  dari: 'BARIS',
})
// Koli tak tertaut pada baris yang seluruh barangnya disposal → disposal dari barisnya.
const semuaDisposalTakTaut = line({
  koli: { totalCount: 2, bareCaseCount: null, details: [pk('x'), pk('y')] },
  items: [item('DISPOSED', ['y'])],
})
assert.deepEqual(keputusanDisposisiKoli(semuaDisposalTakTaut, pk('x')), {
  keputusan: 'TURUNAN',
  disposisi: 'DISPOSAL',
  dari: 'BARIS',
})

// Keputusan manual mengalahkan turunan barang pada pembagian job turunan.
// 1) Baris tanpa item + koli manual DISPOSAL: koli itu ke DISPOSAL, sisanya tetap re-ekspor.
const noItemsManual = line({
  koli: {
    totalCount: 3,
    bareCaseCount: null,
    details: [pkDisposisi('m1', 'DISPOSAL'), pk('m2'), pk('m3')],
  },
})
const [noItemsDisposal] = stageCiplLines([noItemsManual], 'DISPOSAL')
assert.deepEqual(noItemsDisposal.koli.details.map((koli) => koli.id), ['m1'])
assert.equal(noItemsDisposal.koli.totalCount, 1)
assert.equal(noItemsDisposal.items.length, 0)
const [noItemsRe] = stageCiplLines([noItemsManual], 'RE_EXPORT')
assert.deepEqual(noItemsRe.koli.details.map((koli) => koli.id), ['m2', 'm3'])
assert.equal(noItemsRe.koli.totalCount, 2)
// Keputusan koli menuntut job turunannya walau barang belum dirinci.
assert.deepEqual(expectedDerivedStages([noItemsManual], 'TPPB_BC_23'), ['DISPOSAL'])

// 2) Semua koli manual DISPOSAL pada baris tanpa item: RE_EXPORT tidak mendapat apa pun.
const allManual = line({
  koli: {
    totalCount: 2,
    bareCaseCount: null,
    details: [pkDisposisi('m1', 'DISPOSAL'), pkDisposisi('m2', 'DISPOSAL')],
  },
})
assert.deepEqual(stageCiplLines([allManual], 'RE_EXPORT'), [])
assert.equal(stageCiplLines([allManual], 'DISPOSAL')[0].koli.totalCount, 2)

// 3) Baris semua-disposal + satu koli manual RE_EXPORT: koli itu tetap kembali.
const disposalWithKeep = line({
  koli: {
    totalCount: 3,
    bareCaseCount: null,
    details: [pkDisposisi('b1', 'RE_EXPORT'), pk('b2'), pk('b3')],
  },
  items: [item('DISPOSED', ['b1']), item('DISPOSED', ['b2']), item('DISPOSED', ['b3'])],
})
const [keepRe] = stageCiplLines([disposalWithKeep], 'RE_EXPORT')
assert.deepEqual(keepRe.koli.details.map((koli) => koli.id), ['b1'])
assert.equal(keepRe.koli.totalCount, 1)
assert.equal(keepRe.items.length, 0)
const [keepDisposal] = stageCiplLines([disposalWithKeep], 'DISPOSAL')
assert.deepEqual(keepDisposal.koli.details.map((koli) => koli.id), ['b2', 'b3'])
assert.equal(keepDisposal.koli.totalCount, 2)

// 4) Baris campur: koli yang dirujuk barang re-ekspor tapi diputuskan manual DISPOSAL ikut DISPOSAL.
const campurManual = line({
  koli: {
    totalCount: 2,
    bareCaseCount: null,
    details: [pkDisposisi('c1', 'DISPOSAL'), pk('c2')],
  },
  items: [item('RE_EXPORT', ['c1']), item('RE_EXPORT', ['c2'])],
})
const [campurDisposal] = stageCiplLines([campurManual], 'DISPOSAL')
assert.deepEqual(campurDisposal.koli.details.map((koli) => koli.id), ['c1'])
assert.equal(campurDisposal.koli.totalCount, 1)
const [campurRe] = stageCiplLines([campurManual], 'RE_EXPORT')
assert.deepEqual(campurRe.koli.details.map((koli) => koli.id), ['c2'])
assert.equal(campurRe.koli.totalCount, 1)

// Selisih CIPL vs job turunan aktif (menurut rezim).
const reExportOnly = [line({ items: [item('RE_EXPORT')] })]
assert.deepEqual(stageReconciliation(reExportOnly, [], 'TPPB_BC_23'), [
  { stage: 'RE_EXPORT', kind: 'MISSING' },
])
assert.deepEqual(stageReconciliation(reExportOnly, ['RE_EXPORT', 'DISPOSAL'], 'TPPB_BC_23'), [
  { stage: 'DISPOSAL', kind: 'UNEXPECTED' },
])
assert.deepEqual(stageReconciliation([line({})], ['DISPOSAL'], 'TPPB_BC_23'), [])
// ATA: job disposal aktif selalu UNEXPECTED walau ada barang disposal di CIPL.
assert.deepEqual(
  stageReconciliation([line({ items: [item('DISPOSED')] })], ['DISPOSAL'], 'ATA_CARNET'),
  [{ stage: 'DISPOSAL', kind: 'UNEXPECTED' }],
)

// Tahap job baru: hanya international non-road yang bertahap.
assert.equal(stageForNewJob('INTERNATIONAL', 'TPPB_BC_23'), 'INBOUND')
assert.equal(stageForNewJob('INTERNATIONAL', 'ROAD_SHIPMENT'), null)
assert.equal(stageForNewJob('LOCAL', null), null)

console.log('job stages passed')
