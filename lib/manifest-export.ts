// Model export inward manifest satu event. Menangkap MAKSUD dokumen klien (contoh "INWARD MANIFEST
// ALLPACK": satu blok per kiriman — pengirim, dokumen, isi per exhibitor s.d. koli, status, posisi
// di venue) dengan perbaikan kolom yang disetujui pengguna 2026-11-02:
//   - kolom "No" dibuang; Job No (S.01, L.01, …) kolom pertama,
//   - data milik JOB (Job No, Notes) dan EXHIBITOR (nama, Total Package, Hall, Booth) hanya ditulis di
//     baris pertamanya; sel TIDAK digabung supaya garis sel tetap muncul di setiap baris (seperti
//     dokumen klien), sehingga milestone tidak tampak seolah milik koli tertentu,
//   - Total Package berupa angka (dapat dijumlah); subtotal & total juga menjumlah paket,
//   - baris kepala job hanya nilai identitas kiriman `PIHAK / nomor B/L / muatan` (tanpa label); angka total di subtotal,
//   - label koli di kolom CASE; kolom Bare Case, Empty Storage, dan Re-export tidak diekspor.
//
//   Sheet tunggal "Inward Manifest": judul (nama pameran) · "Exhibits Details For Inward Movement" · venue
//     (tanggal) · kepala kolom merah 2 baris · bagian per jenis (TPPB tanpa judul, lalu baris merah
//     ROAD SHIPMENT / PERMANENT IMPORT / …) · per job: kepala berwarna (nilai saja, tanpa label),
//     baris per koli (CBM = rumus L*W*H) dengan Remark berisi daftar isian tetap ETA / Nopen / SPPB /
//     Bonded / BC 2.5 / BC 3.0 / Return, subtotal =SUM. Sheet Return List tidak lagi diekspor.
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
import { jobLabel } from '@/domain/job/numbering'

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

export type ManifestSheetModel = {
  name: string
  columnWidths: number[]
  rows: ManifestRow[]
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

/** Baris kepala job = nilai saja tanpa label, urutan tetap: PIHAK / NOMOR B/L atau AWB / MUATAN. */
export function blockHeaderText(view: ManifestBlockView): string {
  const parts = [view.partyName.toUpperCase()]
  if (view.transportDocument) parts.push(view.transportDocument.number)
  const load = loadLabel(view)
  if (load) parts.push(load)
  return parts.join(' / ')
}

/**
 * Kolom Remark: daftar isian tetap, satu butir per baris. Butir yang punya milestone di job
 * (ETA, SPPB, Bonded) diisi nilainya; sisanya hanya label untuk dilengkapi operator.
 */
const REMARK_SLOTS: ReadonlyArray<{ label: string; milestone: MilestoneKind | null }> = [
  { label: 'ETA', milestone: 'ETA' },
  { label: 'Nopen', milestone: null },
  { label: 'SPPB', milestone: 'SPPB' },
  { label: 'Bonded', milestone: 'MASUK_BONDED' },
  { label: 'BC 2.5', milestone: null },
  { label: 'BC 3.0', milestone: null },
  { label: 'Return', milestone: null },
]

export function remarkRows(view: ManifestBlockView): string[] {
  return REMARK_SLOTS.map(({ label, milestone }) => {
    const found = milestone && view.inward ? findMilestone(view.inward.milestones, milestone) : null
    // SPPB bernomor menampilkan nomor suratnya (seperti dokumen klien), selain itu tanggal.
    const value = found ? (found.documentNumber ?? ddmmyyyy(found.date)) : ''
    return value ? `${label}: ${value}` : `${label}:`
  })
}

/** Kolom Notes: catatan job (`job.notes`), lalu catatan manifest apa adanya; satu entri per baris teks. */
export function noteLines(job: Job, view: ManifestBlockView): Array<{ text: string; highlight: boolean }> {
  const own = job.notes ? [{ text: job.notes, highlight: false }] : []
  const manifest = (view.inward?.notes ?? []).map((note) => ({
    text: note.text,
    // Catatan pengalihan (BC 2.7) & penahanan disorot merah seperti di dokumen klien.
    highlight: note.kind !== 'ANOMALI_BARANG' && /BC\s*\.?\s*2\.?7|HOLD/i.test(note.text),
  }))
  return [...own, ...manifest].flatMap((entry) =>
    entry.text
      .split('\n')
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ text, highlight: entry.highlight })),
  )
}

// ---------------------------------------------------------------------------------------------
// Sheet 1 — Inward Manifest
// ---------------------------------------------------------------------------------------------

export const INWARD_COLUMNS = [
  'Job No',
  'Exhibitor Name',
  'Total Package',
  'CASE',
  'L',
  'W',
  'H',
  'CBM',
  'Weight Kgs',
  'Remark',
  'Hall',
  'Booth No',
  'Notes',
] as const
const COL = {
  jobNo: 0,
  exhibitor: 1,
  totalPackage: 2,
  caseLabel: 3,
  length: 4,
  width: 5,
  height: 6,
  cbm: 7,
  weight: 8,
  remark: 9,
  hall: 10,
  booth: 11,
  notes: 12,
} as const
const LAST = INWARD_COLUMNS.length - 1
const letter = (column: number) => String.fromCharCode(65 + column)

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
  const merged = (kind: ManifestRowKind, text: string, tone?: BlockTone): ManifestRow => {
    const cells = emptyCells()
    cells[0] = text
    return { kind, cells, merges: fullWidth, tone }
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
        details.forEach((detail, index) => {
          const cells = emptyCells()
          if (index === 0) {
            const pic = peserta.line.exhibitorId ? exhibitorPic.get(peserta.line.exhibitorId) : undefined
            cells[COL.exhibitor] = pic && section.key === 'LOCAL' ? `${peserta.name}\nPIC : ${pic}` : peserta.name
            cells[COL.totalPackage] = summarizeKoli(koli).totalCount
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
      }
      if (rows.length === blockStart) {
        const cells = emptyCells()
        cells[COL.exhibitor] = 'Belum ada baris CIPL'
        rows.push({ kind: 'DATA', cells })
      }

      // Data milik job hanya ditulis di baris pertama blok; sel tidak digabung supaya garis sel tetap ada di tiap baris.
      const first = rows[blockStart]
      first.cells[COL.jobNo] =
        formatJobNumber(job.manifestPrefix, job.manifestSeq, null) ?? jobLabel(job)
      // Notes: satu baris catatan per baris tabel (catatan job lalu catatan manifest).
      const notes = noteLines(job, view)
      // Blok dipadatkan agar semua butir Remark (daftar isian tetap) dan semua baris Notes muat.
      while (rows.length - blockStart < Math.max(REMARK_SLOTS.length, notes.length)) {
        rows.push({ kind: 'DATA', cells: emptyCells() })
      }
      remarkRows(view).forEach((text, index) => {
        rows[blockStart + index].cells[COL.remark] = text
      })
      notes.forEach((note, index) => {
        const row = rows[blockStart + index]
        row.cells[COL.notes] = note.text
        if (note.highlight) row.highlight = [COL.notes]
      })

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
    columnWidths: [16, 52, 10, 12, 8, 8, 8, 10, 12, 22, 8, 12, 36],
    rows,
    columnFormats: { [COL.cbm]: '0.000', [COL.weight]: '#,##0.00', [COL.totalPackage]: '0' },
  }
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
  return { sheets: [inwardSheet(event, jobs, exhibitorPic)] }
}
