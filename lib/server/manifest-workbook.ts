import 'server-only'

// Perender model inward manifest (`lib/manifest-export.ts`) menjadi file .xlsx bergaya dokumen
// klien: warna baris (judul, kepala kolom merah, bagian merah, kepala job kuning/hijau), huruf
// tebal, garis sel, lebar kolom, dan rumus CBM/subtotal yang tetap hidup di Excel.

import ExcelJS from 'exceljs'

import type {
  BlockTone,
  ManifestRow,
  ManifestSheetModel,
  ManifestWorkbookModel,
} from '@/lib/manifest-export'

const FILL = {
  TITLE: 'FF993300',
  COLUMN_HEADER: 'FFC0504D',
  SECTION: 'FFC00000',
  HIGHLIGHT: 'FFFF0000',
}
const TONE_FILL: Record<BlockTone, string | null> = {
  YELLOW: 'FFFFFF00',
  LIGHT_GREEN: 'FF66FF33',
  GREEN: 'FF92D050',
  NONE: null,
}

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

/** Gaya per jenis baris; ukuran huruf mengikuti dokumen klien pada sheet manifest. */
function styleFor(row: ManifestRow, large: boolean) {
  const base = large ? 16 : 11
  switch (row.kind) {
    case 'TITLE':
      return { font: { bold: true, size: large ? 22 : 12, color: large ? { argb: 'FFFFFFFF' } : undefined }, fill: large ? FILL.TITLE : null, height: large ? 28.5 : 18, border: false }
    case 'SUBTITLE':
      return { font: { bold: true, size: 18 }, fill: null, height: 23.5, border: false }
    case 'VENUE':
      return { font: { bold: true, size: 20 }, fill: null, height: 25.5, border: false }
    case 'COLUMN_HEADER':
      return { font: { bold: true, size: large ? 12 : 11, color: large ? { argb: 'FFFFFFFF' } : undefined }, fill: large ? FILL.COLUMN_HEADER : null, height: large ? 20 : 16, border: true }
    case 'SECTION':
      return { font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }, fill: FILL.SECTION, height: 23.5, border: true }
    case 'BLOCK_HEADER':
      return { font: { bold: true, size: 18 }, fill: TONE_FILL[row.tone ?? 'NONE'], height: 23.5, border: true }
    case 'SUBTOTAL':
    case 'TOTAL':
      return { font: { bold: true, size: base }, fill: null, height: large ? 19.5 : 16, border: true }
    default:
      return { font: { size: base }, fill: null, height: large ? 22.5 : 16, border: true }
  }
}

function renderSheet(workbook: ExcelJS.Workbook, model: ManifestSheetModel, large: boolean) {
  const sheet = workbook.addWorksheet(model.name, {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  sheet.columns = model.columnWidths.map((width) => ({ width }))
  const columnCount = model.columnWidths.length

  model.rows.forEach((row, index) => {
    const excelRow = sheet.getRow(index + 1)
    const style = styleFor(row, large)
    excelRow.height = style.height
    for (let column = 0; column < columnCount; column += 1) {
      const cell = excelRow.getCell(column + 1)
      const value = row.cells[column] ?? null
      cell.value = value === null ? null : typeof value === 'object' ? { formula: value.formula } : value
      cell.font = style.font
      cell.alignment = {
        // Sel data yang digabung vertikal (Remark, nama exhibitor) dibaca dari atas.
        vertical: row.kind === 'DATA' ? 'top' : 'middle',
        wrapText: true,
        horizontal: row.kind === 'COLUMN_HEADER' ? 'center' : undefined,
      }
      if (style.fill) cell.fill = solid(style.fill)
      // Sorotan (catatan BC 2.7 / penahanan): huruf merah tebal agar teks tetap terbaca.
      if (row.highlight?.includes(column)) {
        cell.font = { ...style.font, bold: true, color: { argb: FILL.HIGHLIGHT } }
      }
      if (style.border) cell.border = thin
    }
    for (const [from, to] of row.merges ?? []) sheet.mergeCells(index + 1, from + 1, index + 1, to + 1)
  })

  for (const range of model.rangeMerges ?? []) {
    sheet.mergeCells(range.fromRow + 1, range.fromColumn + 1, range.toRow + 1, range.toColumn + 1)
  }
  fitRowHeights(sheet, model, large)
  for (const [column, format] of Object.entries(model.columnFormats ?? {})) {
    sheet.getColumn(Number(column) + 1).numFmt = format
  }

  // Kepala kolom dua baris: kolom tunggal digabung vertikal (A4:A5, …); "Dimension" sudah
  // digabung horizontal di atas L/W/H.
  model.rows.forEach((row, index) => {
    const next = model.rows[index + 1]
    if (row.kind !== 'COLUMN_HEADER' || next?.kind !== 'COLUMN_HEADER') return
    const horizontal = row.merges ?? []
    for (let column = 0; column < columnCount; column += 1) {
      const inHorizontal = horizontal.some(([from, to]) => column >= from && column <= to)
      if (!inHorizontal && row.cells[column] !== null && next.cells[column] === null) {
        sheet.mergeCells(index + 1, column + 1, index + 2, column + 1)
      }
    }
  })

  return sheet
}

/** Perkiraan jumlah baris tampilan sebuah teks dalam sel selebar `width` (satuan lebar kolom Excel). */
function visualLines(text: string, width: number, fontSize: number): number {
  const charsPerLine = Math.max(1, Math.floor((width * 11) / fontSize))
  return text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
}

/**
 * Pastikan teks multi-baris (Remark, nama exhibitor + PIC) tidak terpotong: tinggi baris (atau
 * jumlah tinggi baris sel gabungan) dinaikkan bila kurang. Kekurangan ditambahkan ke baris
 * terakhir rentang agar baris koli di atasnya tetap rapat.
 */
function fitRowHeights(sheet: ExcelJS.Worksheet, model: ManifestSheetModel, large: boolean) {
  const fontSize = large ? 16 : 11
  const lineHeight = fontSize * 1.35
  const ranges = new Map<string, { fromRow: number; toRow: number }>()
  for (const range of model.rangeMerges ?? []) {
    ranges.set(`${range.fromRow}:${range.fromColumn}`, range)
  }
  model.rows.forEach((row, rowIndex) => {
    if (row.kind !== 'DATA') return
    row.cells.forEach((value, column) => {
      if (typeof value !== 'string') return
      const lines = visualLines(value, model.columnWidths[column] ?? 10, fontSize)
      if (lines <= 1) return // teks satu baris muat di tinggi baris standar
      const range = ranges.get(`${rowIndex}:${column}`) ?? { fromRow: rowIndex, toRow: rowIndex }
      const needed = lines * lineHeight + 4
      let current = 0
      for (let index = range.fromRow; index <= range.toRow; index += 1) {
        current += sheet.getRow(index + 1).height ?? 15
      }
      if (needed > current) {
        const last = sheet.getRow(range.toRow + 1)
        last.height = (last.height ?? 15) + (needed - current)
      }
    })
  })
}

/** Bangun file .xlsx dari model workbook. Sheet pertama (inward manifest) memakai huruf besar. */
export async function renderManifestWorkbook(model: ManifestWorkbookModel): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'VSS'
  workbook.created = new Date()
  model.sheets.forEach((sheet, index) => renderSheet(workbook, sheet, index === 0))
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
