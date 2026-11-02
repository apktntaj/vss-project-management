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
    vssNumber: `VSS-0000${counter}`,
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
// Kepala job: PIHAK / DOKUMEN / MUATAN / PKG / KGM / CBM.
assert.equal(
  blockHeaderText(buildManifestView(s1)),
  'SHENZHEN BOBON LOGISTICS CO.,LTD / SHFPSJKT26026454 / LCL / 3 PKG / 1,093.00 KGM / 3.947 CBM',
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
assert.match(blockHeaderText(buildManifestView(fcl)), / \/ 1X20' \+ 1X40' \/ /)

const road = job({ internationalJenis: 'ROAD_SHIPMENT', manifestPrefix: 'RS', transportMode: 'ROAD', party: { kind: 'AGENT', id: 'e', name: 'EASYGO' }, inward: null, transportDocumentNumber: null })
const local = job({
  kind: 'LOCAL',
  internationalJenis: null,
  manifestPrefix: 'LOC',
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
assert.equal(rows[0].cells[0], 'ALLPACK INDONESIA')
assert.equal(rows[1].cells[0], 'Exhibits Details For Inward Movement')
assert.equal(rows[2].cells[0], 'JIEXPO, KEMAYORAN (20 - 23 OCT. 2026)')
assert.equal(rows[3].cells[INWARD_COLUMNS.indexOf('L')], 'Dimension')
assert.equal(rows[4].cells[INWARD_COLUMNS.indexOf('L')], 'L')

// Urutan bagian: TPPB (tanpa judul) → ROAD SHIPMENT → LOCAL; S.01 sebelum S.02.
const kinds = rows.map((row) => `${row.kind}:${row.kind === 'SECTION' || row.kind === 'BLOCK_HEADER' ? String(row.cells[0]).slice(0, 18) : ''}`)
const order = kinds.filter((kind) => kind.startsWith('SECTION') || kind.startsWith('BLOCK_HEADER'))
assert.deepEqual(order, [
  'BLOCK_HEADER:SHENZHEN BOBON LOG',
  'BLOCK_HEADER:SHENZHEN BOBON LOG',
  'SECTION:ROAD SHIPMENT',
  'BLOCK_HEADER:EASYGO / 0 PKG / 0',
  'SECTION:LOCAL',
  'BLOCK_HEADER:PT. REPASSA',
])
const tppbHeader = rows.findIndex((row) => row.kind === 'BLOCK_HEADER')
assert.equal(rows[tppbHeader].tone, 'YELLOW')
assert.equal(rows.find((row) => String(row.cells[0]).startsWith('EASYGO'))?.tone, 'LIGHT_GREEN')

// Blok S.01: Job No di baris data pertama (tanpa akhiran invoice), CBM rumus L*W*H, Remark berurutan.
const first = rows[tppbHeader + 1].cells
assert.equal(first[INWARD_COLUMNS.indexOf('Job No')], 'S.01')
assert.equal(first[INWARD_COLUMNS.indexOf('Exhibitor Name')], 'WUHU CHURUI')
assert.equal(first[INWARD_COLUMNS.indexOf('Total \nPackage')], '3 PKG')
assert.equal(first[INWARD_COLUMNS.indexOf('Booth No')], 'C302')
const excelRow = tppbHeader + 2 // baris Excel 1-based dari baris data pertama
assert.deepEqual(first[INWARD_COLUMNS.indexOf('CBM')], { formula: `(G${excelRow}*H${excelRow}*I${excelRow}/1000000)` })
const remarks = rows.slice(tppbHeader + 1, tppbHeader + 5).map((row) => row.cells[INWARD_COLUMNS.indexOf('Remark')])
assert.deepEqual(remarks, ['Eta : 28/09/2026', 'Skep : S-622/WBC.08/2026', 'SPPB : 02/09/2026', 'BC.27 TO NICE KRISTA INTERFOOD'])
assert.deepEqual(rows[tppbHeader + 4].highlight, [INWARD_COLUMNS.indexOf('Remark')])
// Subtotal setelah 4 baris (3 koli + 1 baris remark tambahan).
const subtotal = rows[tppbHeader + 5]
assert.equal(subtotal.kind, 'SUBTOTAL')
assert.deepEqual(subtotal.cells[INWARD_COLUMNS.indexOf('CBM')], { formula: `SUM(J${excelRow}:J${excelRow + 3})` })

// LOCAL: nomor urut di kolom No, nama perusahaan sebagai kepala blok, baris PIC.
const localHeader = rows.findIndex((row) => row.cells[0] === 'PT. REPASSA')
assert.equal(rows[localHeader].tone, 'NONE')
assert.equal(rows[localHeader + 1].cells[0], 1)
assert.equal(rows[localHeader + 2].cells[INWARD_COLUMNS.indexOf('Exhibitor Name')], 'PIC : Bpk. Charles')
assert.equal(rows[rows.length - 1].kind, 'TOTAL')

// Return list: LCL dari kepulangan job Local; container kosong (tidak ada kepulangan FCL).
const lcl = workbook.sheets[2]
assert.equal(lcl.rows[0].cells[0], 'RETURN LIST LCL ALLPACK INDONESIA')
assert.deepEqual(lcl.rows[2].cells.slice(0, 5), [1, null, 'PT. Repassa', '1 Pkg', 'Jakarta'])
assert.equal(lcl.rows[2].cells[8], '10/11/2026')
assert.equal(workbook.sheets[1].rows.length, 2)

console.log('event manifest export passed')
