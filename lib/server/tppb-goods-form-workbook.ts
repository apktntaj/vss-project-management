import 'server-only'

// Perender model form rincian barang (`lib/tppb-goods-form.ts`) menjadi .xlsx mengikuti layout
// contoh klien: kepala uraian penyelenggaraan, identitas a)–f), lalu tabel persetujuan barang.

import ExcelJS from 'exceljs'

import type { TppbGoodsFormModel } from '@/lib/tppb-goods-form'

const COLUMN_WIDTHS = [5.73, 75.73, 12.36, 12.63, 8, 20.45, 29.45, 22, 22]
const FONT = { name: 'Cambria', size: 11 }
const BOLD = { ...FONT, bold: true }
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}
const TABLE_HEADER_ROW = 14

export async function renderTppbGoodsFormWorkbook(model: TppbGoodsFormModel): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Rincian Barang')
  COLUMN_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })

  const titles = [
    'URAIAN PENYELENGGARAAN PAMERAN',
    'PADA PENGUSAHA TEMPAT PENYELENGGARAAN',
    `PAMERAN BERIKAT TETAP ${model.operatorName.toUpperCase()}`,
  ]
  titles.forEach((title, index) => {
    const row = index + 1
    sheet.mergeCells(`A${row}:I${row}`)
    const cell = sheet.getCell(`A${row}`)
    cell.value = title
    cell.font = BOLD
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  const identity: Array<[string, string, string]> = [
    ['a)', 'Nama Organizer', `: ${model.operatorName}`],
    ['b)', 'Nomor Pokok Wajib Pajak', `: ${model.operatorNpwp}`],
    ['c)', 'Alamat Perusahaan', `: ${model.operatorAddress}`],
    ['d)', 'Judul Pameran', `: ${model.exhibitionTitle}`],
    ['e)', 'Waktu Pelaksanaan Pameran', `: ${model.period}`],
    ['f)', 'Rencana Barang yang Dimasukan ke TPPB dengan mendapatkan fasilitas', ':'],
  ]
  identity.forEach(([marker, label, value], index) => {
    const row = 5 + index
    const a = sheet.getCell(`A${row}`)
    a.value = marker
    a.font = BOLD
    a.alignment = { horizontal: 'center', vertical: 'top' }
    const b = sheet.getCell(`B${row}`)
    b.value = label
    b.font = BOLD
    b.alignment = { horizontal: 'left', vertical: 'top' }
    const c = sheet.getCell(`C${row}`)
    c.value = value
    c.font = BOLD
    c.alignment = { horizontal: 'left', vertical: 'top', wrapText: false }
  })

  sheet.mergeCells('A12:I13')
  const banner = sheet.getCell('A12')
  banner.value = 'Persetujuan Rincian Jenis dan Jumlah Barang Pameran'
  banner.font = BOLD
  banner.alignment = { horizontal: 'center', vertical: 'middle' }
  for (const row of [12, 13]) {
    for (let column = 1; column <= COLUMN_WIDTHS.length; column += 1) {
      sheet.getCell(row, column).border = THIN
    }
  }

  const headers = [
    'No',
    'Jenis Barang',
    'Jumlah yang diajukan',
    'Jumlah yang disetujui',
    'Satuan',
    model.currency ? `Nilai Barang (${model.currency})` : 'Nilai Barang',
    'Pemilik Barang/Peserta',
    'NPWP',
    'Status Subjek Pajak (SPDN/SPLN)',
  ]
  const headerRow = sheet.getRow(TABLE_HEADER_ROW)
  headerRow.height = 36.5
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = header
    cell.font = BOLD
    cell.border = THIN
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })

  model.rows.forEach((item, index) => {
    const row = sheet.getRow(TABLE_HEADER_ROW + 1 + index)
    const values: Array<string | number | null> = [
      item.no,
      item.description,
      item.quantity,
      null,
      item.unit,
      item.unitValue,
      item.owner,
      item.npwp,
      item.taxStatus,
    ]
    values.forEach((value, column) => {
      const cell = row.getCell(column + 1)
      cell.value = value
      cell.font = FONT
      cell.border = THIN
      cell.alignment = {
        horizontal: column === 1 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: column === 1 || column === 6,
      }
    })
    row.getCell(6).numFmt = '#,##0.00'
  })

  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${TABLE_HEADER_ROW}:${TABLE_HEADER_ROW}`,
    margins: { left: 0.58, right: 0.21, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  }

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
