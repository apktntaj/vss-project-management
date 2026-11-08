// Pemindaian kolom HS pada invoice Excel untuk tool Cek LARTAS. Murni: menerima matriks sel per
// sheet (hasil baca xlsx) dan memutuskan kolom mana yang berisi HS code, tanpa I/O maupun React.

import { normalizeHsCode } from './job-lartas'

/** Satu sheet yang sudah dibaca menjadi baris × kolom; baris pertama biasanya header. */
export type SheetMatrix = { name: string; rows: ReadonlyArray<ReadonlyArray<unknown>> }

export type HsSheetColumn = {
  sheet: string
  /** Huruf kolom Excel (A, B, ... AB). */
  column: string
  /** Isi sel pertama kolom itu (header), bila berupa teks. */
  header: string | null
  /** Jumlah baris pada kolom itu yang berisi HS 8 digit (10 digit dihitung 8 digit pertama). */
  found: number
}

export type HsRow = {
  sheet: string
  /** Nomor baris pada sheet (1-based, seperti yang terlihat di Excel). */
  row: number
  /** Nilai sel apa adanya. */
  raw: string
  /** HS 8 digit siap dikirim ke INSW. */
  hsCode: string
}

export type HsScan = {
  rows: HsRow[]
  columns: HsSheetColumn[]
  /** Sel berisi angka yang mirip kode tetapi bukan 8/10 digit (mis. 6 digit). */
  skipped: number
}

const HEADER_HINTS = /(^|\W)(hs|btki|tarif|pos)(\W|$)/i
const HS_LIKE = /^\d{6,10}$/

/** Huruf kolom Excel dari indeks 0: A, B, ..., Z, AA, AB, ... */
export function columnLetter(index: number): string {
  let rest = index
  let label = ''
  do {
    label = String.fromCharCode(65 + (rest % 26)) + label
    rest = Math.floor(rest / 26) - 1
  } while (rest >= 0)
  return label
}

/** Teks sel yang aman dibaca sebagai kode; tanggal dan objek lain diabaikan. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'string') return value.trim()
  return ''
}

function weightColumn(header: string | null, found: number): number {
  // Header yang menyebut HS/tarif/pos menang atas kolom lain yang kebetulan berisi angka 8 digit.
  return found + (header && HEADER_HINTS.test(header) ? 1000 : 0)
}

/** Pindai tiap sheet: pilih satu kolom HS terbaik, lalu ambil HS per barisnya. */
export function scanHsColumns(sheets: ReadonlyArray<SheetMatrix>): HsScan {
  const rows: HsRow[] = []
  const columns: HsSheetColumn[] = []
  let skipped = 0

  for (const sheet of sheets) {
    const width = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0)
    if (width === 0) continue

    let best: { index: number; found: number; header: string | null; weight: number } | null = null
    for (let index = 0; index < width; index += 1) {
      let found = 0
      for (const row of sheet.rows) {
        if (normalizeHsCode(cellText(row[index]))) found += 1
      }
      if (found === 0) continue
      const header = cellText(sheet.rows[0]?.[index]) || null
      const weight = weightColumn(header, found)
      if (!best || weight > best.weight) best = { index, found, header, weight }
    }
    if (!best) continue

    const columnIndex = best.index
    columns.push({
      sheet: sheet.name,
      column: columnLetter(columnIndex),
      header: best.header,
      found: best.found,
    })

    sheet.rows.forEach((row, rowIndex) => {
      const text = cellText(row[columnIndex])
      if (!text) return
      const normalized = normalizeHsCode(text)
      if (normalized) {
        rows.push({ sheet: sheet.name, row: rowIndex + 1, raw: text, hsCode: normalized.digits })
        return
      }
      // Hanya hitung sebagai dilewati bila sel memang tampak seperti kode, bukan teks biasa.
      if (HS_LIKE.test(text.replace(/\D/g, ''))) skipped += 1
    })
  }

  return { rows, columns, skipped }
}

/** HS unik dari hasil pindai, urut sesuai kemunculan pertama. */
export function uniqueHsCodes(scan: HsScan): string[] {
  return [...new Set(scan.rows.map((row) => row.hsCode))]
}
