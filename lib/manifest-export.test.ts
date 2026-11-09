import assert from 'node:assert/strict'

import {
  INWARD_COLUMNS,
  blockHeaderText,
  buildEventManifestWorkbook,
  formatVenueLine,
} from './manifest-export'
import { buildManifestView } from './manifest-view'
import type { Job, JobCiplLine } from '@/domain/job/types'

const koli = (rows: Array<[number, number, number, number]>) => ({
  totalCount: rows.length,
  bareCaseCount: null,
  details: rows.map(([lengthCm, widthCm, heightCm, weightKg], index) => ({
    label: `PK ${index + 1}`,
    dimension: { lengthCm, widthCm, heightCm },
    volumeCbm: (lengthCm * widthCm * heightCm) / 1_000_000,
    weightKg,
  })),
})
const line = (overrides: Partial<JobCiplLine>): JobCiplLine => ({
  id: 'l', exhibitorId: null, exhibitor: null, nameOnDocument: 'X', koli: koli([[100, 100, 100, 10]]), items: [], notes: [], ...overrides,
})
let counter = 0
const job = (overrides: Partial<Job>): Job =>
  ({
    id: `job-${++counter}`,
    jobNumber: null,
    eventId: 'e1',
    kind: 'INTERNATIONAL',
    internationalJenis: 'TPPB_BC_23',
    transportMode: 'SEA',
    manifestPrefix: 'S',
    manifestSeq: null,
    party: { kind: 'AGENT', id: 'a', name: 'Shenzhen Bobon Logistics Co.,Ltd' },
    transportDocumentType: 'BL',
    transportDocumentNumber: 'SHFPSJKT26026454',
    inward: {
      loadConfiguration: { kind: 'LCL' },
      milestones: [
        { kind: 'SPPB', date: '2026-09-02', documentNumber: null },
        { kind: 'SKEP', date: '2026-09-02', documentNumber: 'S-622/WBC.08/2026' },
        { kind: 'ETA', date: '2026-09-28', documentNumber: null },
      ],
      notes: [{ kind: 'LAINNYA', text: 'BC.27 TO NICE KRISTA INTERFOOD' }],
    },
    kepulangan: null,
    emptyStorage: null,
    reExport: null,
    ciplLines: [],
    createdAt: `2026-11-01T00:00:0${counter}Z`,
    ...overrides,
  }) as Job

// Baris venue seperti dokumen klien.
assert.equal(
  formatVenueLine({ name: 'x', venueName: 'Jiexpo, Kemayoran', startsOn: '2026-10-20', endsOn: '2026-10-23' }),
  'JIEXPO, KEMAYORAN (20 - 23 OCT. 2026)',
)
assert.equal(
  formatVenueLine({ name: 'x', venueName: 'NICE', startsOn: '2026-10-30', endsOn: '2026-11-02' }),
  'NICE (30 OCT. - 2 NOV. 2026)',
)

const s1 = job({
  manifestSeq: 1,
  notes: 'Jangan lupa makan',
  commercialInvoiceNumber: 'INV-1',
  ciplLines: [
    line({
      exhibitorId: 'x1',
      exhibitor: { id: 'x1', name: 'WUHU CHURUI', hall: null, booth: 'C302' },
      koli: koli([[120, 101, 202, 428], [93, 63, 72, 120], [126, 96, 89, 545]]),
    }),
  ],
})
// Kepala job = nilai saja, tanpa label "B/L": PIHAK / NOMOR DOKUMEN / MUATAN.
assert.equal(
  blockHeaderText(buildManifestView(s1)),
  'SHENZHEN BOBON LOGISTICS CO.,LTD / SHFPSJKT26026454 / LCL',
)
const fcl = job({
  manifestSeq: 2,
  inward: {
    loadConfiguration: {
      kind: 'FCL',
      containers: [
        { containerNumber: null, size: 'K20', sealNumber: null },
        { containerNumber: null, size: 'K40', sealNumber: null },
      ],
    },
    milestones: [],
    notes: [],
  },
})
assert.match(blockHeaderText(buildManifestView(fcl)), / \/ 1X20' \+ 1X40'$/)

const road = job({ internationalJenis: 'ROAD_SHIPMENT', manifestPrefix: 'R', transportMode: 'ROAD', party: { kind: 'AGENT', id: 'e', name: 'EASYGO' }, inward: null, transportDocumentNumber: null })
const local = job({
  kind: 'LOCAL',
  internationalJenis: null,
  manifestPrefix: 'L',
  party: { kind: 'EXHIBITOR', id: 'x9', name: 'PT. Repassa' },
  inward: null,
  transportDocumentNumber: null,
  ciplLines: [line({ exhibitorId: 'x9', exhibitor: { id: 'x9', name: 'PT. REPASSA', hall: 'A3', booth: 'AB002' } })],
  kepulangan: {
    mode: { kind: 'LCL', koliCount: 1 },
    destination: 'Jakarta',
    shippingLine: null,
    bookingNumber: null,
    vessel: null,
    etd: '2026-11-10',
    eta: null,
    notes: [],
  },
})

const workbook = buildEventManifestWorkbook(
  { name: 'Allpack Indonesia', venueName: 'Jiexpo, Kemayoran', startsOn: '2026-10-20', endsOn: '2026-10-23' },
  [local, road, fcl, s1],
  new Map([['x9', 'Bpk. Charles']]),
)
assert.deepEqual(workbook.sheets.map((sheet) => sheet.name), ['Inward Manifest'])

const sheet = workbook.sheets[0]
const rows = sheet.rows
const col = (name: (typeof INWARD_COLUMNS)[number]) => INWARD_COLUMNS.indexOf(name)
assert.equal(rows[0].cells[0], 'ALLPACK INDONESIA')
assert.equal(rows[1].cells[0], 'Exhibits Details For Inward Movement')
assert.equal(rows[2].cells[0], 'JIEXPO, KEMAYORAN (20 - 23 OCT. 2026)')
// Kolom "No" dibuang: Job No kolom pertama.
assert.equal(INWARD_COLUMNS[0], 'Job No')
assert.equal(rows[3].cells[col('L')], 'Dimension (cm)')
assert.equal(rows[4].cells[col('L')], 'L')

// Urutan bagian: TPPB (tanpa judul) → ROAD SHIPMENT → LOCAL; S.01 sebelum S.02.
const order = rows
  .filter((row) => row.kind === 'SECTION' || row.kind === 'BLOCK_HEADER')
  .map((row) => `${row.kind}:${String(row.cells[0]).slice(0, 18)}`)
assert.deepEqual(order, [
  'BLOCK_HEADER:SHENZHEN BOBON LOG',
  'BLOCK_HEADER:SHENZHEN BOBON LOG',
  'SECTION:ROAD SHIPMENT',
  'BLOCK_HEADER:EASYGO',
  'SECTION:LOCAL',
  'BLOCK_HEADER:PT. REPASSA',
])
const tppbHeader = rows.findIndex((row) => row.kind === 'BLOCK_HEADER')
assert.equal(rows[tppbHeader].tone, 'YELLOW')
assert.equal(rows.find((row) => String(row.cells[0]).startsWith('EASYGO'))?.tone, 'LIGHT_GREEN')

// Blok S.01: tiga baris koli dipadatkan jadi tujuh baris supaya semua butir Remark muat.
const start = tppbHeader + 1
const first = rows[start].cells
assert.equal(first[col('Job No')], 'S.01')
assert.equal(first[col('Exhibitor Name')], 'WUHU CHURUI')
assert.equal(first[col('Total Package')], 3)
assert.equal(first[col('CASE')], 'PK 1')
assert.equal(first[col('Booth No')], 'C302')
// Kolom Bare Case, Empty Storage, dan Re-export tidak diekspor.
for (const removed of ['Bare Case', 'Empty Storage', 'Re-export']) assert.ok(!(INWARD_COLUMNS as readonly string[]).includes(removed))
const excelRow = start + 1
assert.deepEqual(first[col('CBM')], { formula: `(E${excelRow}*F${excelRow}*G${excelRow}/1000000)` })
// Remark: daftar isian tetap; butir bermilestone (ETA, SPPB) diisi, sisanya label saja.
assert.deepEqual(
  rows.slice(start, start + 7).map((row) => row.cells[col('Remark')]),
  ['ETA: 28/09/2026', 'Nopen:', 'SPPB: 02/09/2026', 'Bonded:', 'BC 2.5:', 'BC 3.0:', 'Return:'],
)
// Notes: satu catatan per baris (catatan job lalu catatan manifest); hanya baris catatan BC 2.7 yang disorot.
assert.deepEqual(rows.slice(start, start + 3).map((row) => row.cells[col('Notes')]), ['Jangan lupa makan', 'BC.27 TO NICE KRISTA INTERFOOD', null])
assert.equal(rows[start].highlight, undefined)
assert.deepEqual(rows[start + 1].highlight, [col('Notes')])
assert.equal(rows[start + 7].kind, 'SUBTOTAL')
assert.deepEqual(rows[start + 7].cells[col('Total Package')], { formula: `SUM(C${excelRow}:C${excelRow + 6})` })
assert.deepEqual(rows[start + 7].cells[col('CBM')], { formula: `SUM(H${excelRow}:H${excelRow + 6})` })
// Tanpa sel gabungan: data job/exhibitor hanya di baris pertama, baris lain kosong tetapi tetap berupa sel bergaris.
assert.ok(!('rangeMerges' in sheet))
for (const name of ['Job No', 'Exhibitor Name', 'Total Package', 'Hall', 'Booth No'] as const) {
  assert.equal(rows[start + 1].cells[col(name)], null, `${name} hanya di baris pertama`)
}

// Catatan banyak baris memperpanjang blok melebihi tujuh baris Remark.
const manyNotes = buildEventManifestWorkbook(
  { name: 'x', venueName: null, startsOn: null, endsOn: null },
  [job({ manifestSeq: 9, notes: Array.from({ length: 9 }, (_, i) => `catatan ${i + 1}`).join('\n'), inward: null, ciplLines: [] })],
).sheets[0].rows
const manyStart = manyNotes.findIndex((row) => row.kind === 'BLOCK_HEADER') + 1
assert.equal(manyNotes[manyStart + 9].kind, 'SUBTOTAL')
assert.equal(manyNotes[manyStart + 8].cells[col('Notes')], 'catatan 9')

// Road shipment tanpa No Job: nomor VSS sebagai pengenal; baris "Belum ada baris CIPL".
const roadStart = rows.findIndex((row) => String(row.cells[0]).startsWith('EASYGO')) + 1
assert.equal(rows[roadStart].cells[col('Job No')], 'R.-')
assert.equal(rows[roadStart].cells[col('Exhibitor Name')], 'Belum ada baris CIPL')

// LOCAL: kepala blok nama pihak; PIC ikut di sel nama exhibitor.
const localHeader = rows.findIndex((row) => row.cells[0] === 'PT. REPASSA')
assert.equal(rows[localHeader].tone, 'NONE')
assert.equal(rows[localHeader + 1].cells[col('Exhibitor Name')], 'PT. REPASSA\nPIC : Bpk. Charles')
const total = rows[rows.length - 1]
assert.equal(total.kind, 'TOTAL')
assert.equal(total.cells[col('Exhibitor Name')], 'TOTAL')

console.log('event manifest export passed')
