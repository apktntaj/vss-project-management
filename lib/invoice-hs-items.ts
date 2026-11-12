// Membaca baris barang (uraian + HS code) dari invoice Excel untuk tool "HS BTKI". Murni: menerima
// matriks sel per sheet, tanpa I/O. Berbeda dari `lartas-sheet.ts`, HS di sini boleh 4–12 digit
// karena invoice luar negeri jarang menulis pos BTKI 8 digit.

import type { SheetMatrix } from './lartas-sheet'

export type InvoiceHsItem = {
  id: string
  /** Asal baris pada Excel; null bila dibaca AI dari PDF. */
  sheet: string | null
  row: number | null
  description: string
  /** HS apa adanya seperti tertulis di invoice. */
  hsCode: string
}

export const INVOICE_HS_MAX_ITEMS = 400

const HS_HEADER = /(^|[^a-z])(h\.?\s?s\.?|hts|btki|tariff|tarif|pos tarif|commodity code)([^a-z]|$)/i
const DESC_HEADER = /description|uraian|nama barang|jenis barang|goods|commodity|item name|product|品名/i
const HEADER_SCAN_ROWS = 40

function cellText(value: unknown): string {
  if (value === null || value === undefined || value instanceof Date) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  return ''
}

/** Teks sel sebagai HS code, atau null bila bukan kode. "8504.4" (angka Excel) dipulihkan jadi "8504.40". */
export function hsCellText(value: unknown): string | null {
  let text = cellText(value)
  if (!text || !/^[\d\s.\-]+$/.test(text)) return null
  if (/^\d{4}\.\d$/.test(text)) text += '0'
  const digits = text.replace(/\D/g, '')
  if (digits.length < 4 || digits.length > 12) return null
  const chapter = Number(digits.slice(0, 2))
  return chapter >= 1 ? text : null
}

function findHeader(rows: SheetMatrix['rows']): { row: number; hs: number; desc: number | null } | null {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, HEADER_SCAN_ROWS); rowIndex += 1) {
    const cells = rows[rowIndex].map(cellText)
    const hs = cells.findIndex((text) => text.length <= 40 && HS_HEADER.test(text))
    if (hs === -1) continue
    const desc = cells.findIndex((text, index) => index !== hs && DESC_HEADER.test(text) && !HS_HEADER.test(text))
    return { row: rowIndex, hs, desc: desc === -1 ? null : desc }
  }
  return null
}

/** Tanpa header yang dikenali: kolom dengan sel mirip HS (6–10 digit) terbanyak. */
function guessHsColumn(rows: SheetMatrix['rows'], width: number): number | null {
  let best: { index: number; found: number } | null = null
  for (let index = 0; index < width; index += 1) {
    let found = 0
    for (const row of rows) {
      const digits = hsCellText(row[index])?.replace(/\D/g, '') ?? ''
      if (digits.length >= 6 && digits.length <= 10) found += 1
    }
    if (found > 0 && (!best || found > best.found)) best = { index, found }
  }
  return best?.index ?? null
}

/** Kolom uraian = kolom dengan teks (bukan angka) terpanjang pada baris yang punya HS. */
function guessDescriptionColumn(rows: SheetMatrix['rows'], width: number, hsColumn: number): number | null {
  let best: { index: number; length: number } | null = null
  for (let index = 0; index < width; index += 1) {
    if (index === hsColumn) continue
    let length = 0
    for (const row of rows) {
      if (!hsCellText(row[hsColumn])) continue
      const text = cellText(row[index])
      if (/\p{L}/u.test(text)) length += text.length
    }
    if (length > 0 && (!best || length > best.length)) best = { index, length }
  }
  return best?.index ?? null
}

/** Baris barang dari tiap sheet: satu kolom HS dan satu kolom uraian per sheet. */
export function readInvoiceHsItems(sheets: ReadonlyArray<SheetMatrix>): InvoiceHsItem[] {
  const items: InvoiceHsItem[] = []
  for (const sheet of sheets) {
    const width = sheet.rows.reduce((max, row) => Math.max(max, row.length), 0)
    if (width === 0) continue
    const header = findHeader(sheet.rows)
    const hsColumn = header?.hs ?? guessHsColumn(sheet.rows, width)
    if (hsColumn === null) continue
    const descColumn = header?.desc ?? guessDescriptionColumn(sheet.rows, width, hsColumn)

    sheet.rows.forEach((row, rowIndex) => {
      if (header && rowIndex <= header.row) return
      const hsCode = hsCellText(row[hsColumn])
      if (!hsCode || items.length >= INVOICE_HS_MAX_ITEMS) return
      items.push({
        id: String(items.length + 1),
        sheet: sheet.name,
        row: rowIndex + 1,
        description: descColumn === null ? '' : cellText(row[descColumn]),
        hsCode,
      })
    })
  }
  return items
}
