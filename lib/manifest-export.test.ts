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
  commercialInvoiceNumber: 'INV-1',
  ciplLines: [
    line({
      exhibitorId: 'x1',
      exhibitor: { id: 'x1', name: 'WUHU CHURUI', hall: null, booth: 'C302' },
      koli: koli([[120, 101, 202, 428], [93, 63, 72, 120], [126, 96, 89, 545]]),
    }),
  ],
})
// Kepala job = identitas kiriman saja: PIHAK / DOKUMEN / MUATAN (angka total ada di subtotal).
assert.equal(
  blockHeaderText(buildManifestView(s1)),
  'SHENZHEN BOBON LOGISTICS CO.,LTD / B/L SHFPSJKT26026454 / LCL',
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
assert.deepEqual(workbook.sheets.map((sheet) => sheet.name), ['Inward Manifest', 'Return List Container', 'Return List LCL'])

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

// Blok S.01: tiga baris koli saja (remark tidak lagi menambah baris kosong).
const start = tppbHeader + 1
const first = rows[start].cells
assert.equal(first[col('Job No')], 'S.01')
assert.equal(first[col('Exhibitor Name')], 'WUHU CHURUI')
assert.equal(first[col('Total Package')], 3)
assert.equal(first[col('CASE')], 'PK 1')
assert.equal(first[col('Bare Case')], null)
assert.equal(first[col('Booth No')], 'C302')
const excelRow = start + 1
assert.deepEqual(first[col('CBM')], { formula: `(F${excelRow}*G${excelRow}*H${excelRow}/1000000)` })
// Remark milik job: satu sel berisi semua baris, disorot karena ada catatan BC 2.7.
assert.equal(first[col('Remark')], 'Eta : 28/09/2026\nSkep : S-622/WBC.08/2026\nSPPB : 02/09/2026\nBC.27 TO NICE KRISTA INTERFOOD')
assert.deepEqual(rows[start].highlight, [col('Remark')])
assert.equal(rows[start + 3].kind, 'SUBTOTAL')
assert.deepEqual(rows[start + 3].cells[col('Total Package')], { formula: `SUM(C${excelRow}:C${excelRow + 2})` })
assert.deepEqual(rows[start + 3].cells[col('CBM')], { formula: `SUM(I${excelRow}:I${excelRow + 2})` })
// Sel milik job & exhibitor digabung sepanjang tiga baris koli.
const merges = sheet.rangeMerges ?? []
for (const name of ['Job No', 'Remark', 'Empty Storage', 'Re-export', 'Exhibitor Name', 'Total Package', 'Hall', 'Booth No'] as const) {
  assert.ok(
    merges.some((m) => m.fromRow === start && m.toRow === start + 2 && m.fromColumn === col(name)),
    `kolom ${name} digabung sepanjang blok`,
  )
}
assert.ok(!merges.some((m) => m.fromColumn === col('CASE')), 'kolom koli tidak digabung')

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

// Return list: LCL dari kepulangan job Local; container kosong (tidak ada kepulangan FCL).
const lcl = workbook.sheets[2]
assert.equal(lcl.rows[0].cells[0], 'RETURN LIST LCL ALLPACK INDONESIA')
assert.deepEqual(lcl.rows[2].cells.slice(0, 5), [1, null, 'PT. Repassa', '1 Pkg', 'Jakarta'])
assert.equal(lcl.rows[2].cells[8], '10/11/2026')
assert.equal(workbook.sheets[1].rows.length, 2)

console.log('event manifest export passed')
