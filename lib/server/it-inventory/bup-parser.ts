import 'server-only'

import * as XLSX from 'xlsx'

import { ApiError } from '@/lib/server/errors'
import type { BupBarangLine, BupDocument, BupDocumentCode } from '@/domain/it-inventory/types'

// Mengapa: pembaca export BUP (workbook CEISA 21-sheet relasional, header di baris 1, data dari
// baris 2) menjadi BupDocument ramping. Semua keanehan format yang sudah teridentifikasi pada
// file nyata ditangani di sini agar lapisan domain tetap bersih:
// - nama kolom duplikat di HEADER (mis. KODE GUDANG ASAL 2x) → ambil kemunculan pertama;
// - tanggal campuran: string ISO, date-cell, atau dd/mm/yyyy;
// - angka kadang berupa string.

type Matrix = unknown[][]

const supportedCodes: readonly BupDocumentCode[] = ['23', '25', '30']

function sheetMatrix(workbook: XLSX.WorkBook, name: string): Matrix {
  const sheet = workbook.Sheets[name]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true })
}

/** Peta nama kolom → index (kemunculan PERTAMA; BUP memiliki nama header duplikat). */
function columnMap(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>()
  headerRow.forEach((name, index) => {
    if (typeof name !== 'string') return
    const key = name.trim().toUpperCase()
    if (key && !map.has(key)) map.set(key, index)
  })
  return map
}

function cell(row: unknown[], map: Map<string, number>, column: string): unknown {
  const index = map.get(column)
  if (index === undefined || index >= row.length) return null
  return row[index] ?? null
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Normalisasi tanggal ke `YYYY-MM-DD` (string ISO, Date cell, atau dd/mm/yyyy). */
function isoDate(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    // Serial Excel ditulis sebagai tengah malam UTC; bagian kalender UTC adalah tanggal yang benar.
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const loose = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T].*)?$/.exec(s)
  if (loose) {
    // Export CEISA menulis sel tanggal teks gaya AS (mm-dd-yyyy); tukar hanya bila hal itu mustahil.
    const first = Number(loose[1])
    const second = Number(loose[2])
    const [month, day] = first > 12 && second <= 12 ? [second, first] : [first, second]
    return `${loose[3]}-${pad2(month)}-${pad2(day)}`
  }
  return null
}

function text(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return isoDate(value)
  const s = String(value).trim()
  return s === '' ? null : s
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function intOrNull(value: unknown): number | null {
  const parsed = num(value)
  return parsed == null ? null : Math.round(parsed)
}

function parseHeaderRow(matrix: Matrix, fileName: string): { code: BupDocumentCode; row: unknown[] } {
  const headerRow = matrix[0] ?? []
  const map = columnMap(headerRow)
  const dataRow = matrix.slice(1).find((row) => row.some((value) => value != null && value !== ''))
  if (!map.size || !dataRow) {
    throw new ApiError(
      400,
      `Sheet HEADER pada ${fileName} kosong — pastikan file adalah export BUP dokumen pabean.`,
    )
  }
  const rawCode = text(cell(dataRow, map, 'KODE DOKUMEN'))
  const code = supportedCodes.find((supported) => supported === rawCode)
  if (!code) {
    throw new ApiError(
      400,
      `Dokumen ${rawCode ? `BC ${rawCode}` : 'tanpa kode dokumen'} pada ${fileName} belum didukung — demo ini menerima BC 2.3, BC 2.5, dan BC 3.0.`,
    )
  }
  return { code, row: dataRow }
}

function parseBarangLines(matrix: Matrix, fileName: string): BupBarangLine[] {
  if (matrix.length < 1) {
    throw new ApiError(400, `Sheet BARANG tidak ditemukan pada ${fileName}.`)
  }
  const map = columnMap(matrix[0] ?? [])
  const lines: BupBarangLine[] = []
  for (const row of matrix.slice(1)) {
    if (!row.some((value) => value != null && value !== '')) continue
    const description = text(cell(row, map, 'URAIAN'))
    if (!description) continue // baris noise tanpa uraian tidak bisa menjadi jenis barang
    lines.push({
      seri: intOrNull(cell(row, map, 'SERI BARANG')),
      hsCode: text(cell(row, map, 'HS')),
      itemCode: text(cell(row, map, 'KODE BARANG')),
      description,
      brand: text(cell(row, map, 'MEREK')),
      type: text(cell(row, map, 'TIPE')),
      size: text(cell(row, map, 'UKURAN')),
      unitCode: text(cell(row, map, 'KODE SATUAN')),
      quantity: num(cell(row, map, 'JUMLAH SATUAN')) ?? 0,
      netWeightKg: num(cell(row, map, 'NETTO')),
      grossWeightKg: num(cell(row, map, 'BRUTO')),
      cifValue: num(cell(row, map, 'CIF')),
      unitPrice: num(cell(row, map, 'HARGA SATUAN')),
      lineValue: num(cell(row, map, 'NILAI BARANG')),
      countryCode: text(cell(row, map, 'KODE NEGARA ASAL')),
      sourceDocumentCode: text(cell(row, map, 'KODE DOKUMEN ASAL')),
      sourceRegistrationNumber: text(cell(row, map, 'NOMOR DAFTAR ASAL')),
      sourceRegistrationDate: isoDate(cell(row, map, 'TANGGAL DAFTAR ASAL')),
      sourceLineSeri: intOrNull(cell(row, map, 'SERI BARANG ASAL')),
    })
  }
  if (!lines.length) {
    throw new ApiError(400, `Tidak ada baris barang yang terbaca pada ${fileName}.`)
  }
  return lines
}

function parseOwnerName(matrix: Matrix): string | null {
  if (!matrix.length) return null
  const map = columnMap(matrix[0] ?? [])
  // Kode 3 = pemilik barang (konsisten di BC 2.3/2.5); BC 3.0 hanya memuat kode 2 (importir) —
  // gunakan sebagai fallback agar rekap tetap menampilkan satu nama badan usaha.
  for (const row of matrix.slice(1)) {
    if (text(cell(row, map, 'KODE ENTITAS')) === '3') {
      return text(cell(row, map, 'NAMA ENTITAS'))
    }
  }
  for (const row of matrix.slice(1)) {
    if (text(cell(row, map, 'KODE ENTITAS')) === '2') {
      return text(cell(row, map, 'NAMA ENTITAS'))
    }
  }
  return null
}

/**
 * Bukti pemasukan/pengeluaran dari sheet DOKUMEN: commercial invoice (kode dokumen 380) menjadi
 * referensi bukti utama — nomor + tanggal. Fallback kode 7XX dokumen transport bila 380 absen.
 */
function parseInvoice(matrix: Matrix): { number: string | null; date: string | null } {
  if (!matrix.length) return { number: null, date: null }
  const map = columnMap(matrix[0] ?? [])
  const rows = matrix.slice(1)
  const invoiceRow = rows.find((row) => text(cell(row, map, 'KODE DOKUMEN')) === '380')
  const fallbackRow = invoiceRow ?? rows.find((row) => {
    const kode = text(cell(row, map, 'KODE DOKUMEN'))
    return kode != null && /^7\d\d$/.test(kode)
  })
  if (!fallbackRow) return { number: null, date: null }
  return {
    number: text(cell(fallbackRow, map, 'NOMOR DOKUMEN')),
    date: isoDate(cell(fallbackRow, map, 'TANGGAL DOKUMEN')),
  }
}

/**
 * Parse buffer file BUP menjadi `BupDocument` (belum tervalidasi — route memvalidasi dengan
 * `bupDocumentSchema` di batas). Gagal fatal berupa `ApiError(400)` dengan pesan Indonesia.
 */
export function parseBupWorkbook(fileName: string, buffer: Buffer): BupDocument {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const headerMatrix = sheetMatrix(workbook, 'HEADER')
  const { code, row } = parseHeaderRow(headerMatrix, fileName)
  const headerMap = columnMap(headerMatrix[0] ?? [])
  const invoice = parseInvoice(sheetMatrix(workbook, 'DOKUMEN'))

  return {
    fileName,
    documentCode: code,
    nomorAju: text(cell(row, headerMap, 'NOMOR AJU')),
    nomorDaftar: text(cell(row, headerMap, 'NOMOR DAFTAR')),
    tanggalDaftar: isoDate(cell(row, headerMap, 'TANGGAL DAFTAR')),
    kantor: text(cell(row, headerMap, 'KODE KANTOR')),
    bruto: num(cell(row, headerMap, 'BRUTO')),
    netto: num(cell(row, headerMap, 'NETTO')),
    cif: num(cell(row, headerMap, 'CIF')),
    currency: text(cell(row, headerMap, 'KODE VALUTA')),
    ownerName: parseOwnerName(sheetMatrix(workbook, 'ENTITAS')),
    invoiceNumber: invoice.number,
    invoiceDate: invoice.date,
    // Stempel waktu posting diisi route import (jam server), bukan dari isi file.
    uploadedAt: null,
    items: parseBarangLines(sheetMatrix(workbook, 'BARANG'), fileName),
  }
}
