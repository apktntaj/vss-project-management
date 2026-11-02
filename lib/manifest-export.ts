// Model export inward manifest satu event. Menangkap MAKSUD dokumen klien (contoh "INWARD MANIFEST
// ALLPACK": satu blok per kiriman — pengirim, dokumen, isi per exhibitor s.d. koli, status, posisi
// di venue) dengan perbaikan kolom yang disetujui pengguna 2026-11-02:
//   - kolom "No" dibuang; Job No (S.01, LOC.01, …) kolom pertama,
//   - data milik JOB (Job No, Empty Storage, Re-export, Remark) = satu sel digabung per blok,
//     data milik EXHIBITOR (nama, Total Package, Bare Case, Hall, Booth) = satu sel per exhibitor,
//     sehingga milestone tidak lagi tampak seolah milik koli tertentu,
//   - Total Package berupa angka (dapat dijumlah); subtotal & total juga menjumlah paket,
//   - baris kepala job hanya identitas kiriman `PIHAK / B/L / muatan`; angka total di subtotal,
//   - label koli di kolom CASE, Bare Case hanya jumlah.
//
//   Sheet "Inward Manifest": judul (nama pameran) · "Exhibits Details For Inward Movement" · venue
//     (tanggal) · kepala kolom merah 2 baris · bagian per jenis (TPPB tanpa judul, lalu baris merah
//     ROAD SHIPMENT / PERMANENT IMPORT / …) · per job: kepala berwarna, baris per koli (CBM = rumus
//     L*W*H), subtotal =SUM.
//   Sheet "Return List Container" & "Return List LCL" — dari data kepulangan job.
//
// Fungsi murni: menghasilkan model baris + gaya semantik, tanpa pustaka spreadsheet, agar dapat
// diuji. Perender (exceljs) ada di `lib/server/manifest-workbook.ts`.

import {
  findMilestone,
  summarizeKoli,
  type ContainerSize,
  type MilestoneKind,
} from '@/domain/job/manifest'
import { formatJobNumber } from '@/domain/job/numbering'
import type { InternationalJobJenis, Job } from '@/domain/job/types'
import { buildManifestView, type ManifestBlockView } from '@/lib/manifest-view'
import { sortJobsForTable } from '@/lib/job-list'

export type ManifestCellValue = string | number | { formula: string } | null

/** Gaya semantik baris; warna konkret ditentukan perender. */
export type ManifestRowKind =
  | 'TITLE'
  | 'SUBTITLE'
  | 'VENUE'
  | 'COLUMN_HEADER'
  | 'SECTION'
  | 'BLOCK_HEADER'
  | 'DATA'
  | 'SUBTOTAL'
  | 'TOTAL'

/** Warna baris kepala job per bagian, mengikuti dokumen klien. */
export type BlockTone = 'YELLOW' | 'LIGHT_GREEN' | 'GREEN' | 'NONE'

export type ManifestRow = {
  kind: ManifestRowKind
  cells: ManifestCellValue[]
  /** Rentang kolom (0-based, inklusif) yang digabung pada baris ini. */
  merges?: Array<[number, number]>
  tone?: BlockTone
  /** Kolom yang disorot merah (mis. catatan pengalihan BC 2.7 di Remark). */
  highlight?: number[]
}

/** Penggabungan sel lintas baris (0-based, inklusif). */
export type ManifestRangeMerge = { fromRow: number; toRow: number; fromColumn: number; toColumn: number }

export type ManifestSheetModel = {
  name: string
  columnWidths: number[]
  rows: ManifestRow[]
  /** Sel digabung vertikal (data milik job / exhibitor yang membentang beberapa baris koli). */
  rangeMerges?: ManifestRangeMerge[]
  /** Format angka Excel per kolom (0-based). */
  columnFormats?: Record<number, string>
}

export type ManifestWorkbookModel = { sheets: ManifestSheetModel[] }

export type ManifestEventInfo = {
  name: string
  venueName: string | null
  startsOn: string | null
  endsOn: string | null
}

// ---------------------------------------------------------------------------------------------
// Format teks
// ---------------------------------------------------------------------------------------------

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "JIEXPO, KEMAYORAN (20 - 23 OCT. 2026)" — rentang dirapatkan bila bulan/tahun sama. */
export function formatVenueLine(event: ManifestEventInfo): string {
  const venue = (event.venueName ?? 'VENUE BELUM DIISI').toUpperCase()
  if (!event.startsOn) return venue
  const [sy, sm, sd] = event.startsOn.split('-').map(Number)
  const [ey, em, ed] = (event.endsOn ?? event.startsOn).split('-').map(Number)
  const start = `${sd}${sm === em && sy === ey ? '' : ` ${MONTHS[sm - 1]}.`}${sy === ey ? '' : ` ${sy}`}`
  const range = sd === ed && sm === em && sy === ey ? `${sd}` : `${start} - ${ed}`
  return `${venue} (${range} ${MONTHS[em - 1]}. ${ey})`
}

const ddmmyyyy = (value: string) => value.split('-').reverse().join('/')

const CONTAINER_LABEL: Record<ContainerSize, string> = { K20: "20'", K40: "40'", K40HQ: "40'HQ" }

/** "LCL", "1X40'HQ", "1X20' + 1X40'". */
function loadLabel(view: ManifestBlockView): string | null {
  const configuration = view.inward?.loadConfiguration
  if (!configuration) return null
  if (configuration.kind === 'LCL') return 'LCL'
  const counts = new Map<ContainerSize, number>()
  for (const container of configuration.containers) {
    counts.set(container.size, (counts.get(container.size) ?? 0) + 1)
  }
  return (['K20', 'K40', 'K40HQ'] as const)
    .filter((size) => counts.has(size))
    .map((size) => `${counts.get(size)}X${CONTAINER_LABEL[size]}`)
    .join(' + ')
}

/** Baris kepala job = identitas kiriman: PIHAK / DOKUMEN / MUATAN. Angka total ada di subtotal. */
export function blockHeaderText(view: ManifestBlockView): string {
  const parts = [view.partyName.toUpperCase()]
  if (view.transportDocument) {
    parts.push(`${view.transportDocument.type === 'BL' ? 'B/L' : 'AWB'} ${view.transportDocument.number}`)
  }
  const load = loadLabel(view)
  if (load) parts.push(load)
  return parts.join(' / ')
}

/** Ejaan label Remark mengikuti dokumen klien (bukan label aplikasi). */
const REMARK_LABELS: Record<MilestoneKind, string> = {
  ETA: 'Eta',
  SKEP: 'Skep',
  SPPB: 'SPPB',
  STRIPPING_SELESAI: 'Selesai stripping',
  MASUK_BONDED: 'Masuk Bonded',
  BAHANDLE_SELESAI: 'Selesai Bahandle',
  PERIKSA_SELESAI: 'Selesai periksa',
  DO_READY: 'DO ready',
}

const REMARK_ORDER: MilestoneKind[] = [
  'ETA',
  'SKEP',
  'SPPB',
  'STRIPPING_SELESAI',
  'MASUK_BONDED',
  'BAHANDLE_SELESAI',
  'PERIKSA_SELESAI',
  'DO_READY',
]

/** Kolom Remark: "Eta : 28/09/2026", "Skep : S-622/WBC.08/2026", lalu catatan apa adanya. */
export function remarkLines(view: ManifestBlockView): Array<{ text: string; highlight: boolean }> {
  const inward = view.inward
  if (!inward) return []
  const milestones = REMARK_ORDER.flatMap((kind) => {
    const milestone = findMilestone(inward.milestones, kind)
    if (!milestone) return []
    // Skep/SPPB bernomor menampilkan nomor suratnya (seperti dokumen klien), selain itu tanggal.
    const value = milestone.documentNumber ?? ddmmyyyy(milestone.date)
    return [{ text: `${REMARK_LABELS[kind]} : ${value}`, highlight: false }]
  })
  const notes = inward.notes.map((note) => ({
    text: note.text,
    // Catatan pengalihan (BC 2.7) & penahanan disorot merah seperti di dokumen klien.
    highlight: note.kind !== 'ANOMALI_BARANG' && /BC\s*\.?\s*2\.?7|HOLD/i.test(note.text),
  }))
  return [...milestones, ...notes]
}

// ---------------------------------------------------------------------------------------------
// Sheet 1 — Inward Manifest
// ---------------------------------------------------------------------------------------------

export const INWARD_COLUMNS = [
  'Job No',
  'Exhibitor Name',
  'Total Package',
  'Bare Case',
  'CASE',
  'L',
  'W',
  'H',
  'CBM',
  'Weight Kgs',
  'Empty Storage',
  'Re-export',
  'Remark',
  'Hall',
  'Booth No',
] as const
const COL = {
  jobNo: 0,
  exhibitor: 1,
  totalPackage: 2,
  bareCase: 3,
  caseLabel: 4,
  length: 5,
  width: 6,
  height: 7,
  cbm: 8,
  weight: 9,
  emptyStorage: 10,
  reExport: 11,
  remark: 12,
  hall: 13,
  booth: 14,
} as const
const LAST = INWARD_COLUMNS.length - 1
const letter = (column: number) => String.fromCharCode(65 + column)

/** Kolom milik job (satu sel per blok) dan milik exhibitor (satu sel per exhibitor). */
const JOB_COLUMNS = [COL.jobNo, COL.emptyStorage, COL.reExport, COL.remark]
const EXHIBITOR_COLUMNS = [COL.exhibitor, COL.totalPackage, COL.bareCase, COL.hall, COL.booth]

type SectionKey = InternationalJobJenis | 'LOCAL'

/** Urutan bagian & gaya mengikuti dokumen klien; TPPB pertama tanpa baris judul. */
const SECTIONS: Array<{ key: SectionKey; title: string | null; tone: BlockTone }> = [
  { key: 'TPPB_BC_23', title: null, tone: 'YELLOW' },
  { key: 'TEMPORARY_IMPORT', title: 'TEMPORARY IMPORT', tone: 'YELLOW' },
  { key: 'ROAD_SHIPMENT', title: 'ROAD SHIPMENT', tone: 'LIGHT_GREEN' },
  { key: 'PERMANENT_IMPORT', title: 'PERMANENT IMPORT', tone: 'GREEN' },
  { key: 'ATA_CARNET', title: 'ATA CARNET', tone: 'LIGHT_GREEN' },
  { key: 'LOCAL', title: 'LOCAL', tone: 'NONE' },
]

const sectionOf = (job: Job): SectionKey =>
  job.kind === 'LOCAL' ? 'LOCAL' : (job.internationalJenis ?? 'TPPB_BC_23')

const emptyCells = (): ManifestCellValue[] => Array.from({ length: INWARD_COLUMNS.length }, () => null)
const fullWidth: Array<[number, number]> = [[0, LAST]]

function inwardSheet(
  event: ManifestEventInfo,
  jobs: ReadonlyArray<Job>,
  exhibitorPic: ReadonlyMap<string, string>,
): ManifestSheetModel {
  const rows: ManifestRow[] = []
  const rangeMerges: ManifestRangeMerge[] = []
  const merged = (kind: ManifestRowKind, text: string, tone?: BlockTone): ManifestRow => {
    const cells = emptyCells()
    cells[0] = text
    return { kind, cells, merges: fullWidth, tone }
  }
  const mergeDown = (fromRow: number, toRow: number, columns: ReadonlyArray<number>) => {
    if (toRow <= fromRow) return
    for (const column of columns) rangeMerges.push({ fromRow, toRow, fromColumn: column, toColumn: column })
  }

  rows.push(merged('TITLE', event.name.toUpperCase()))
  rows.push(merged('SUBTITLE', 'Exhibits Details For Inward Movement'))
  rows.push(merged('VENUE', formatVenueLine(event)))

  // Kepala kolom dua baris: kolom tunggal digabung vertikal oleh perender; "Dimension (cm)"
  // digabung horizontal di atas L/W/H.
  const headerTop = INWARD_COLUMNS.map((column, index) =>
    index >= COL.length && index <= COL.height ? null : column,
  ) as ManifestCellValue[]
  headerTop[COL.length] = 'Dimension (cm)'
  rows.push({ kind: 'COLUMN_HEADER', cells: headerTop, merges: [[COL.length, COL.height]] })
  const headerBottom = emptyCells()
  headerBottom[COL.length] = 'L'
  headerBottom[COL.width] = 'W'
  headerBottom[COL.height] = 'H'
  rows.push({ kind: 'COLUMN_HEADER', cells: headerBottom })

  const subtotalRows: number[] = [] // nomor baris Excel (1-based)

  for (const section of SECTIONS) {
    const sectionJobs = sortJobsForTable(
      jobs.filter((job) => sectionOf(job) === section.key),
      new Map(),
    )
    if (!sectionJobs.length) continue
    if (section.title) rows.push(merged('SECTION', section.title))

    for (const job of sectionJobs) {
      const view = buildManifestView(job)
      rows.push(merged('BLOCK_HEADER', blockHeaderText(view), section.tone))

      const blockStart = rows.length // indeks 0-based baris data pertama
      for (const peserta of view.peserta) {
        const koli = peserta.logistics.koli
        const details = koli.details.length ? koli.details : [null]
        const exhibitorStart = rows.length
        details.forEach((detail, index) => {
          const cells = emptyCells()
          if (index === 0) {
            const pic = peserta.line.exhibitorId ? exhibitorPic.get(peserta.line.exhibitorId) : undefined
            cells[COL.exhibitor] = pic && section.key === 'LOCAL' ? `${peserta.name}\nPIC : ${pic}` : peserta.name
            cells[COL.totalPackage] = summarizeKoli(koli).totalCount
            cells[COL.bareCase] = koli.bareCaseCount
            cells[COL.hall] = peserta.logistics.hall
            cells[COL.booth] = peserta.logistics.booth
          }
          cells[COL.caseLabel] = detail?.label ?? null
          const dimension = detail?.dimension ?? null
          cells[COL.length] = dimension?.lengthCm ?? null
          cells[COL.width] = dimension?.widthCm ?? null
          cells[COL.height] = dimension?.heightCm ?? null
          const excelRow = rows.length + 1
          cells[COL.cbm] = dimension
            ? { formula: `(${letter(COL.length)}${excelRow}*${letter(COL.width)}${excelRow}*${letter(COL.height)}${excelRow}/1000000)` }
            : (detail?.volumeCbm ?? null)
          cells[COL.weight] = detail?.weightKg ?? null
          rows.push({ kind: 'DATA', cells })
        })
        mergeDown(exhibitorStart, rows.length - 1, EXHIBITOR_COLUMNS)
      }
      if (rows.length === blockStart) {
        const cells = emptyCells()
        cells[COL.exhibitor] = 'Belum ada baris CIPL'
        rows.push({ kind: 'DATA', cells })
      }

      // Data milik job: satu sel per blok, digabung sepanjang baris kolinya.
      const first = rows[blockStart]
      first.cells[COL.jobNo] =
        formatJobNumber(job.manifestPrefix, job.manifestSeq, null) ?? job.vssNumber
      first.cells[COL.emptyStorage] = job.emptyStorage
      first.cells[COL.reExport] = job.reExport
      const remarks = remarkLines(view)
      first.cells[COL.remark] = remarks.length ? remarks.map((remark) => remark.text).join('\n') : null
      if (remarks.some((remark) => remark.highlight)) first.highlight = [COL.remark]
      mergeDown(blockStart, rows.length - 1, JOB_COLUMNS)

      const firstRow = blockStart + 1
      const lastRow = rows.length
      const subtotal = emptyCells()
      subtotal[COL.exhibitor] = 'Subtotal'
      for (const column of [COL.totalPackage, COL.cbm, COL.weight]) {
        subtotal[column] = { formula: `SUM(${letter(column)}${firstRow}:${letter(column)}${lastRow})` }
      }
      rows.push({ kind: 'SUBTOTAL', cells: subtotal })
      subtotalRows.push(rows.length)
    }
  }

  if (!jobs.length) rows.push(merged('SECTION', 'BELUM ADA JOB PADA EVENT INI'))

  const total = emptyCells()
  total[COL.exhibitor] = 'TOTAL'
  for (const column of [COL.totalPackage, COL.cbm, COL.weight]) {
    total[column] = subtotalRows.length
      ? { formula: subtotalRows.map((row) => `${letter(column)}${row}`).join('+') }
      : 0
  }
  rows.push({ kind: 'TOTAL', cells: total })

  return {
    name: 'Inward Manifest',
    columnWidths: [16, 52, 10, 9, 12, 8, 8, 8, 10, 12, 16, 16, 42, 8, 12],
    rows,
    rangeMerges,
    columnFormats: { [COL.cbm]: '0.000', [COL.weight]: '#,##0.00', [COL.totalPackage]: '0' },
  }
}

// ---------------------------------------------------------------------------------------------
// Sheet 2 & 3 — Return List (kepulangan)
// ---------------------------------------------------------------------------------------------

/** "JS LOGISTICS (Shunde Huaji + …)" — pihak lalu exhibitor di baris CIPL. */
function returnParty(job: Job): string {
  const party = job.party?.name ?? 'Pihak belum ditetapkan'
  const same = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase()
  const exhibitors = job.ciplLines
    // Exhibitor yang sekaligus pihak job tidak diulang di dalam kurung.
    .filter((line) => !(job.party?.kind === 'EXHIBITOR' && line.exhibitorId === job.party.id))
    .map((line) => line.exhibitor?.name ?? line.nameOnDocument)
    .filter((name) => name && !same(name, party))
  return exhibitors.length ? `${party} (${exhibitors.join(' + ')})` : party
}

function returnRows(jobs: ReadonlyArray<Job>, kind: 'FCL' | 'LCL') {
  return sortJobsForTable(
    jobs.filter((job) => job.kepulangan?.mode.kind === kind),
    new Map(),
  )
}

const dateOrNull = (value: string | null) => (value ? ddmmyyyy(value) : null)

function returnContainerSheet(event: ManifestEventInfo, jobs: ReadonlyArray<Job>): ManifestSheetModel {
  const columns = ['No.', 'Doc.', 'Agent / Exhibitor', 'Package', "20'", "40'", "40'HQ", 'Destination', 'Shipping Line', 'Booking No.', 'Vessel', 'ETD', 'ETA', 'Note']
  const rows: ManifestRow[] = []
  const title = columns.map(() => null) as ManifestCellValue[]
  title[0] = `RETURN LIST CONTAINER ${event.name.toUpperCase()}`
  rows.push({ kind: 'TITLE', cells: title, merges: [[0, columns.length - 1]] })
  rows.push({ kind: 'COLUMN_HEADER', cells: [...columns] })
  const items = returnRows(jobs, 'FCL')
  items.forEach((job, index) => {
    const ret = job.kepulangan!
    const containers = ret.mode.kind === 'FCL' ? ret.mode.containers : []
    const count = (size: ContainerSize) => containers.filter((item) => item.size === size).length || null
    const view = buildManifestView(job)
    rows.push({
      kind: 'DATA',
      cells: [
        index + 1,
        formatJobNumber(job.manifestPrefix, job.manifestSeq, null),
        returnParty(job),
        `${view.totals.totalCount} Pkg`,
        count('K20'),
        count('K40'),
        count('K40HQ'),
        ret.destination,
        ret.shippingLine,
        ret.bookingNumber,
        ret.vessel,
        dateOrNull(ret.etd),
        dateOrNull(ret.eta),
        ret.notes.map((note) => note.text).join('; ') || null,
      ],
    })
  })
  if (items.length) {
    const first = 3
    const last = 2 + items.length
    rows.push({
      kind: 'TOTAL',
      cells: [null, null, null, null, ...['E', 'F', 'G'].map((column) => ({ formula: `SUM(${column}${first}:${column}${last})` })), null, null, null, null, null, null, null],
    })
  }
  return { name: 'Return List Container', columnWidths: [5.5, 10, 39.5, 13.5, 8.4, 8.4, 8.4, 14.5, 17.1, 14, 14, 11, 11, 24], rows }
}

function returnLclSheet(event: ManifestEventInfo, jobs: ReadonlyArray<Job>): ManifestSheetModel {
  const columns = ['No.', 'Doc.', 'Agent / Exhibitor', 'Package', 'Destination', 'Forwarder', 'Booking No.', 'Vessel', 'ETD', 'ETA', 'Note']
  const rows: ManifestRow[] = []
  const title = columns.map(() => null) as ManifestCellValue[]
  title[0] = `RETURN LIST LCL ${event.name.toUpperCase()}`
  rows.push({ kind: 'TITLE', cells: title, merges: [[0, columns.length - 1]] })
  rows.push({ kind: 'COLUMN_HEADER', cells: [...columns] })
  returnRows(jobs, 'LCL').forEach((job, index) => {
    const ret = job.kepulangan!
    rows.push({
      kind: 'DATA',
      cells: [
        index + 1,
        formatJobNumber(job.manifestPrefix, job.manifestSeq, null),
        returnParty(job),
        ret.mode.kind === 'LCL' ? `${ret.mode.koliCount} Pkg` : null,
        ret.destination,
        ret.shippingLine,
        ret.bookingNumber,
        ret.vessel,
        dateOrNull(ret.etd),
        dateOrNull(ret.eta),
        ret.notes.map((note) => note.text).join('; ') || null,
      ],
    })
  })
  return { name: 'Return List LCL', columnWidths: [5.5, 10, 39.5, 13.5, 14.5, 17.1, 14, 14, 11, 11, 24], rows }
}

/**
 * Model workbook inward manifest satu event. `exhibitorPic` memetakan id exhibitor → nama PIC
 * (kontak exhibitor) untuk baris "PIC : …" pada bagian LOCAL.
 */
export function buildEventManifestWorkbook(
  event: ManifestEventInfo,
  jobs: ReadonlyArray<Job>,
  exhibitorPic: ReadonlyMap<string, string> = new Map(),
): ManifestWorkbookModel {
  return {
    sheets: [
      inwardSheet(event, jobs, exhibitorPic),
      returnContainerSheet(event, jobs),
      returnLclSheet(event, jobs),
    ],
  }
}
