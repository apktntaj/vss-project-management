import assert from 'node:assert/strict'

import {
  containerLabel,
  findMilestone,
  inwardManifestSchema,
  jobReturnSchema,
  exhibitorLogisticsSchema,
  summarizeKoli,
  summarizeKoliCollections,
  type InwardManifest,
} from './manifest'
import { bcDocumentKinds } from './types'

// Contoh dari inward manifest ALLPACK — S.01: LCL, 1 exhibitor, 3 koli, Skep bernomor.
const s01: InwardManifest = {
  transportDocument: { kind: 'BL', number: 'SHFPSJKT26026454' },
  loadConfiguration: { kind: 'LCL' },
  milestones: [
    { kind: 'ETA', date: '2026-09-28', documentNumber: null },
    { kind: 'SKEP', date: '2026-09-02', documentNumber: 'S-622/WBC.08/2026' },
    { kind: 'SPPB', date: '2026-09-02', documentNumber: null },
  ],
  notes: [],
}

// S.08: FCL 1x40', exhibitor dengan koli parsial (17 PKG, 7 dirinci).
const s08Exhibitor = {
  hall: 'B1',
  booth: 'D007',
  koli: {
    totalCount: 17,
    details: [
      { label: 'PKG 1', dimension: { lengthCm: 205, widthCm: 130, heightCm: 195 }, volumeCbm: 5.2, weightKg: 1100 },
      { label: 'PKG 2', dimension: { lengthCm: 315, widthCm: 60, heightCm: 115 }, volumeCbm: 2.17, weightKg: 450 },
    ],
  },
  notes: [],
}

// S.12: koli tanpa dimensi + anomali barang pada exhibitor tertentu.
const s12Exhibitor = {
  hall: 'C1',
  booth: 'C035',
  koli: { totalCount: 2, details: [{ label: null, dimension: null, volumeCbm: null, weightKg: 190 }] },
  notes: [{ kind: 'ANOMALI_BARANG', text: 'Ada barang anomali 1 carton' }],
}

// A.01: AWB.
const a01: InwardManifest = {
  transportDocument: { kind: 'AWB', number: '235-44415932' },
  loadConfiguration: { kind: 'FCL', containers: [{ containerNumber: null, size: 'K40', sealNumber: null }] },
  milestones: [{ kind: 'ETA', date: '2026-09-23', documentNumber: null }],
  notes: [],
}

// S.09: FCL campuran 20' + 40' (dua kontainer beda ukuran dalam satu job).
const s09: InwardManifest = {
  transportDocument: { kind: 'BL', number: '276509446' },
  loadConfiguration: {
    kind: 'FCL',
    containers: [
      { containerNumber: null, size: 'K20', sealNumber: null },
      { containerNumber: null, size: 'K40', sealNumber: null },
    ],
  },
  milestones: [],
  notes: [],
}

assert.doesNotThrow(() => inwardManifestSchema.parse(s01))
assert.doesNotThrow(() => inwardManifestSchema.parse(a01))
assert.doesNotThrow(() => inwardManifestSchema.parse(s09))
assert.equal(exhibitorLogisticsSchema.safeParse(s08Exhibitor).success, true)
assert.equal(exhibitorLogisticsSchema.safeParse(s12Exhibitor).success, true)

// Invalid: FCL tanpa kontainer; rincian melebihi total; tanggal bukan YYYY-MM-DD.
assert.equal(inwardManifestSchema.safeParse({ ...s01, loadConfiguration: { kind: 'FCL', containers: [] } }).success, false)
assert.equal(exhibitorLogisticsSchema.safeParse({ ...s08Exhibitor, koli: { totalCount: 1, details: s08Exhibitor.koli.details } }).success, false)
assert.equal(
  inwardManifestSchema.safeParse({ ...s01, milestones: [{ kind: 'ETA', date: '28/09/2026', documentNumber: null }] }).success,
  false,
)
// Invalid: dokumen angkut tanpa nomor.
assert.equal(inwardManifestSchema.safeParse({ ...s01, transportDocument: { kind: 'BL', number: ' ' } }).success, false)

// Kepulangan: return list container S.16 (1x20' + 1x40') dan return LCL "Big Logistic (Adam)".
assert.doesNotThrow(() =>
  jobReturnSchema.parse({
    mode: {
      kind: 'FCL',
      containers: [
        { containerNumber: 'KMTCPNC4913153', size: 'K20', sealNumber: null },
        { containerNumber: null, size: 'K40', sealNumber: null },
      ],
    },
    destination: 'Singapore',
    shippingLine: 'KMTC',
    bookingNumber: null,
    vessel: null,
    etd: null,
    eta: null,
    notes: [],
  }),
)
assert.doesNotThrow(() =>
  jobReturnSchema.parse({
    mode: { kind: 'LCL', koliCount: 3 },
    destination: 'Nhavasheva',
    shippingLine: null,
    bookingNumber: null,
    vessel: null,
    etd: null,
    eta: null,
    notes: [],
  }),
)
assert.equal(jobReturnSchema.safeParse({ mode: { kind: 'FCL', containers: [] }, destination: null, shippingLine: null, bookingNumber: null, vessel: null, etd: null, eta: null, notes: [] }).success, false)

// Pertanyaan turunan: total header blok = turunan koli peserta.
const summary = summarizeKoli(s08Exhibitor.koli)
assert.equal(summary.totalCount, 17)
assert.equal(summary.detailedCount, 2)
assert.equal(summary.weightKg, 1550)
assert.equal(summary.volumeCbm, 7.37)

const blockTotals = summarizeKoliCollections([s08Exhibitor.koli, s12Exhibitor.koli, null])
assert.equal(blockTotals.totalCount, 19)
assert.equal(blockTotals.weightKg, 1740)

assert.equal(findMilestone(s01.milestones, 'SKEP')?.documentNumber, 'S-622/WBC.08/2026')
assert.equal(findMilestone(s01.milestones, 'MASUK_BONDED'), null)
assert.equal(containerLabel({ containerNumber: 'COAU6464738840', size: 'K40', sealNumber: null }), "40' · COAU6464738840")

// BC 2.7 masuk set dokumen BC operasional.
assert.ok(bcDocumentKinds.includes('BC_2_7'))

console.log('job manifest data definitions passed')
