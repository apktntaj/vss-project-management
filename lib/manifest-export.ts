// Model export inward manifest satu event. Menangkap MAKSUD dokumen klien (contoh "INWARD MANIFEST
// ALLPACK": satu blok per kiriman — pengirim, dokumen, isi per exhibitor s.d. koli, status, posisi
// di venue) dengan perbaikan kolom yang disetujui pengguna 2026-11-02:
//   - kolom "No" dibuang; Job No (S.01, L.01, …) kolom pertama,
//   - data milik JOB (Job No, Notes) dan EXHIBITOR (nama, Total Package, Hall, Booth) hanya ditulis di
//     baris pertamanya; sel TIDAK digabung supaya garis sel tetap muncul di setiap baris (seperti
//     dokumen klien), sehingga milestone tidak tampak seolah milik koli tertentu,
//   - Total Package berupa angka (dapat dijumlah); subtotal & total juga menjumlah paket,
//   - baris kepala job hanya nilai identitas kiriman `PIHAK / nomor B/L / LCL atau FCL+ukuran (+nomor kontainer) / jumlah package / total berat / total volume` (tanpa label),
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
  summarizeKoliCollections,
  type ContainerSize,
  type ShippingContainer,
  type MilestoneKind,
} from '@/domain/job/manifest'
import { formatJobNumber, jobLabel, jobNumberLabel } from '@/domain/job/numbering'
import { stageCiplLines } from '@/domain/job/stages'
import { customsDocumentLabels, type InternationalJobJenis, type Job } from '@/domain/job/types'
import { stageCustomsDocument } from '@/domain/job/regime'
import {
  buildManifestView,
  pesertaFromLine,
  type ManifestBlockView,
  type ManifestPeserta,
} from '@/lib/manifest-view'
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

/** "20'", "40'", "40'HQ" dari teks bebas B/L ("40'HQ", "40HC", "20GP", "40 High Cube"); teks mentah bila tak terbaca. */
export function normalizeContainerSize(size: string | null, type: string | null): string | null {
  const text = `${size ?? ''} ${type ?? ''}`.toUpperCase()
  const feet = text.match(/(?<!\d)(20|40|45)(?!\d)/)?.[1]
  if (!feet) return (size ?? type)?.trim().toUpperCase() || null
  return /HQ|HC|HIGH\s*CUBE/.test(text) ? `${feet}'HQ` : `${feet}'`
}

type LoadContainer = { size: string | null; number: string | null }

/**
 * "FCL 1X40'HQ (COAU6464738840)", "FCL 1X20' + 1X40' (KMTCPNC4913153, TGHU1234567)"; nomor kontainer
 * yang belum diisi dilewati. "FCL" saja bila belum ada kontainer.
 */
function fclLabel(containers: ReadonlyArray<LoadContainer>): string {
  if (!containers.length) return 'FCL'
  const counts = new Map<string, number>()
  for (const { size } of containers) counts.set(size ?? '?', (counts.get(size ?? '?') ?? 0) + 1)
  const groups = [...counts]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([size, count]) => `${count}X${size}`)
  const numbers = containers.map(({ number }) => number?.trim().toUpperCase()).filter(Boolean)
  const suffix = numbers.length ? ` (${numbers.join(', ')})` : ''
  return `FCL ${groups.join(' + ')}${suffix}`
}

/** Kontainer konfigurasi muatan / kepulangan (ukuran baku K20/K40/K40HQ). */
const shippingContainer = (container: ShippingContainer): LoadContainer => ({
  size: CONTAINER_LABEL[container.size],
  number: container.containerNumber,
})

/**
 * "LCL" atau "FCL <ukuran> (<nomor kontainer>)". Sumber utama: B/L/AWB job (`transportDocument.loadType` +
 * kontainer); bila belum diisi, konfigurasi muatan pada blok inward manifest. Null bila keduanya kosong.
 */
export function loadLabel(job: Job): string | null {
  const transport = job.transportDocument
  if (transport?.loadType === 'LCL') return 'LCL'
  if (transport?.loadType === 'FCL') {
    return fclLabel(
      transport.containers.map((container) => ({
        size: normalizeContainerSize(container.size, container.type),
        number: container.containerNumber,
      })),
    )
  }
  const configuration = job.inward?.loadConfiguration
  if (!configuration) return null
  if (configuration.kind === 'LCL') return 'LCL'
  return fclLabel(configuration.containers.map(shippingContainer))
}

const formatNumber = (value: number, digits: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/**
 * Baris kepala job = nilai saja tanpa label, urutan tetap:
 * PIHAK / NOMOR B/L atau AWB / LCL atau FCL+ukuran (+nomor kontainer) / jumlah package / total berat / total volume.
 */
export function blockHeaderText(job: Job, view: ManifestBlockView): string {
  const parts = [view.partyName.toUpperCase()]
  if (view.transportDocument) parts.push(view.transportDocument.number)
  const load = loadLabel(job)
  if (load) parts.push(load)
  parts.push(
    `${view.totals.totalCount} PKG`,
    `${formatNumber(view.totals.weightKg, 2)} KGS`,
    `${formatNumber(view.totals.volumeCbm, 3)} CBM`,
  )
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
  'Special Instructions',
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
  specialInstructions: 13,
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

// ---------------------------------------------------------------------------------------------
// Penyusun sheet umum (dipakai inward & outward)
// ---------------------------------------------------------------------------------------------

/** Satu blok job: identitas (kepala), peserta (baris koli), Remark, dan Notes. */
export type ManifestBlock = {
  section: SectionKey
  tone: BlockTone
  jobNo: string
  headerText: string
  peserta: ManifestPeserta[]
  exhibitorLabel: (peserta: ManifestPeserta) => string
  remarks: string[]
  notes: Array<{ text: string; highlight: boolean }>
  /** Permintaan khusus klien: baris pertama blok, disorot merah (inward). */
  specialInstructions?: string | null
}

export type ManifestSheetSpec = {
  name: string
  subtitle: string
  emptyBlockText: string
  noJobsText: string
  blocks: ManifestBlock[]
}

function manifestSheet(event: ManifestEventInfo, spec: ManifestSheetSpec): ManifestSheetModel {
  const rows: ManifestRow[] = []
  const merged = (kind: ManifestRowKind, text: string, tone?: BlockTone): ManifestRow => {
    const cells = emptyCells()
    cells[0] = text
    return { kind, cells, merges: fullWidth, tone }
  }

  rows.push(merged('TITLE', event.name.toUpperCase()))
  rows.push(merged('SUBTITLE', spec.subtitle))
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
    // Blok datang sudah terurut dari penyusunnya; saring per bagian dengan urutan masuk.
    const sectionBlocks = spec.blocks.filter((block) => block.section === section.key)
    if (!sectionBlocks.length) continue
    if (section.title) rows.push(merged('SECTION', section.title))

    for (const block of sectionBlocks) {
      rows.push(merged('BLOCK_HEADER', block.headerText, block.tone))

      const blockStart = rows.length // indeks 0-based baris data pertama
      for (const peserta of block.peserta) {
        const koli = peserta.logistics.koli
        const details = koli.details.length ? koli.details : [null]
        details.forEach((detail, index) => {
          const cells = emptyCells()
          if (index === 0) {
            cells[COL.exhibitor] = block.exhibitorLabel(peserta)
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
        cells[COL.exhibitor] = spec.emptyBlockText
        rows.push({ kind: 'DATA', cells })
      }

      // Data milik job hanya ditulis di baris pertama blok; sel tidak digabung supaya garis sel tetap ada di tiap baris.
      const first = rows[blockStart]
      first.cells[COL.jobNo] = block.jobNo
      // Blok dipadatkan agar semua butir Remark dan semua baris Notes muat.
      while (rows.length - blockStart < Math.max(block.remarks.length, block.notes.length)) {
        rows.push({ kind: 'DATA', cells: emptyCells() })
      }
      block.remarks.forEach((text, index) => {
        rows[blockStart + index].cells[COL.remark] = text
      })
      block.notes.forEach((note, index) => {
        const row = rows[blockStart + index]
        row.cells[COL.notes] = note.text
        if (note.highlight) row.highlight = [COL.notes]
      })
      // Special instruction (permintaan khusus klien) milik job: baris pertama, disorot merah sebagai peringatan.
      if (block.specialInstructions) {
        first.cells[COL.specialInstructions] = block.specialInstructions
        first.highlight = [...(first.highlight ?? []), COL.specialInstructions]
      }

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

  if (!spec.blocks.length) rows.push(merged('SECTION', spec.noJobsText))

  const total = emptyCells()
  total[COL.exhibitor] = 'TOTAL'
  for (const column of [COL.totalPackage, COL.cbm, COL.weight]) {
    total[column] = subtotalRows.length
      ? { formula: subtotalRows.map((row) => `${letter(column)}${row}`).join('+') }
      : 0
  }
  rows.push({ kind: 'TOTAL', cells: total })

  return {
    name: spec.name,
    columnWidths: [16, 52, 10, 12, 8, 8, 8, 10, 12, 22, 8, 12, 36, 30],
    rows,
    columnFormats: { [COL.cbm]: '0.000', [COL.weight]: '#,##0.00', [COL.totalPackage]: '0' },
  }
}

/**
 * Model workbook inward manifest satu event: satu blok per job MASUK (BC 2.3 — job turunan tidak
 * punya blok sendiri karena barangnya bagian dari kiriman yang sama). `exhibitorPic` memetakan id
 * exhibitor → nama PIC (kontak exhibitor) untuk baris "PIC : …" pada bagian LOCAL.
 */
export function buildEventManifestWorkbook(
  event: ManifestEventInfo,
  jobs: ReadonlyArray<Job>,
  exhibitorPic: ReadonlyMap<string, string> = new Map(),
): ManifestWorkbookModel {
  const blocks = SECTIONS.flatMap((section) =>
    sortJobsForTable(
      jobs.filter((job) => !job.sourceJobId && sectionOf(job) === section.key),
      new Map(),
    ).map((job) => {
      const view = buildManifestView(job)
      return {
        section: section.key,
        tone: section.tone,
        jobNo: formatJobNumber(job.manifestPrefix, job.manifestSeq, null) ?? jobLabel(job),
        headerText: blockHeaderText(job, view),
        peserta: view.peserta,
        exhibitorLabel: (peserta: ManifestPeserta) => {
          const pic = peserta.line.exhibitorId
            ? exhibitorPic.get(peserta.line.exhibitorId)
            : undefined
          return pic && section.key === 'LOCAL' ? `${peserta.name}\nPIC : ${pic}` : peserta.name
        },
        remarks: remarkRows(view),
        notes: noteLines(job, view),
        specialInstructions: job.specialInstructions,
      } satisfies ManifestBlock
    }),
  )
  return {
    sheets: [
      manifestSheet(event, {
        name: 'Inward Manifest',
        subtitle: 'Exhibits Details For Inward Movement',
        emptyBlockText: 'Belum ada baris CIPL',
        noJobsText: 'BELUM ADA JOB PADA EVENT INI',
        blocks,
      }),
    ],
  }
}

// Muatan kepulangan: "LCL", atau "FCL 1X40'HQ (nomor kontainer)" dari kontainer kepulangan.
function returnLoadLabel(job: Job): string | null {
  const mode = job.kepulangan?.mode
  if (!mode) return null
  if (mode.kind === 'LCL') return 'LCL'
  return fclLabel(mode.containers.map(shippingContainer))
}

const splitNoteText = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

/**
 * Model workbook OUTWARD manifest satu event: satu blok per job re-ekspor (BC 3.0) aktif yang
 * job masuknya ikut dimuat; barang = baris CIPL job masuk disaring disposisi re-ekspor. Kolom
 * mengikuti inward (cermin) sampai ada contoh dokumen klien.
 */
export function buildEventOutwardManifestWorkbook(
  event: ManifestEventInfo,
  jobs: ReadonlyArray<Job>,
): ManifestWorkbookModel {
  const byId = new Map(jobs.map((job) => [job.id, job]))
  const remark = (label: string, value: string | null | undefined) =>
    value ? `${label}: ${value}` : `${label}:`
  const blocks = SECTIONS.flatMap((section) =>
    sortJobsForTable(
      jobs.filter(
        (job) =>
          job.stage === 'RE_EXPORT' &&
          job.status !== 'CANCELLED' &&
          job.sourceJobId != null &&
          byId.has(job.sourceJobId) &&
          sectionOf(job) === section.key,
      ),
      new Map(),
    ).flatMap((job) => {
      const source = byId.get(job.sourceJobId!)
      if (!source) return []
      const document = stageCustomsDocument(job.internationalJenis, 'RE_EXPORT')
      const peserta = stageCiplLines(source.ciplLines, 'RE_EXPORT').map(pesertaFromLine)
      const totals = summarizeKoliCollections(peserta.map((item) => item.logistics.koli))
      const kepulangan = job.kepulangan
      const headerText = [
        (job.party?.name ?? 'Pihak belum ditetapkan').toUpperCase(),
        kepulangan?.destination?.toUpperCase() ?? null,
        returnLoadLabel(job),
        `${totals.totalCount} PKG`,
        `${formatNumber(totals.weightKg, 2)} KGS`,
        `${formatNumber(totals.volumeCbm, 3)} CBM`,
      ]
        .filter(Boolean)
        .join(' / ')
      return [
        {
          section: section.key,
          tone: section.tone,
          jobNo: jobNumberLabel({
            ...job,
            jobNumber: formatJobNumber(job.manifestPrefix, job.manifestSeq, null),
          }),
          headerText,
          peserta,
          exhibitorLabel: (item: ManifestPeserta) => item.name,
          remarks: [
            ...(document != null
              ? [
                  remark(
                    customsDocumentLabels[document],
                    job.operational.customs[document].registrationNumber,
                  ),
                ]
              : []),
            remark('Booking', kepulangan?.bookingNumber),
            remark('Shipping Line', kepulangan?.shippingLine),
            remark('Vessel', kepulangan?.vessel),
            remark('ETD', kepulangan?.etd ? ddmmyyyy(kepulangan.etd) : null),
            remark('ETA', kepulangan?.eta ? ddmmyyyy(kepulangan.eta) : null),
            remark('Destination', kepulangan?.destination),
          ],
          notes: [
            ...(job.notes ? splitNoteText(job.notes) : []),
            ...(kepulangan?.notes ?? []).flatMap((note) => splitNoteText(note.text)),
          ].map((text) => ({ text, highlight: false })),
        } satisfies ManifestBlock,
      ]
    }),
  )
  return {
    sheets: [
      manifestSheet(event, {
        name: 'Outward Manifest',
        subtitle: 'Exhibits Details For Outward Movement',
        emptyBlockText: 'Belum ada barang re-ekspor',
        noJobsText: 'BELUM ADA JOB RE-EKSPOR PADA EVENT INI',
        blocks,
      }),
    ],
  }
}
