import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { z } from 'zod'

import { requireCurrentUser } from '@/features/auth'
import { getJob } from '@/features/jobs'
import { ApiError, toErrorResponse } from '@/lib/server/errors'
import type { Job } from '@/domain/job/types'
import { jobFileName } from '@/domain/job/numbering'

export const runtime = 'nodejs'

type CustomsDocumentType = 'BC_2_3' | 'BC_2_5' | 'BC_3_0'

const templates: Record<CustomsDocumentType, string> = {
  BC_2_3: 'bup-23.xlsx',
  BC_2_5: 'bup-25.xlsx',
  BC_3_0: 'bup-30.xlsx',
}

const documentCodes: Record<CustomsDocumentType, string> = {
  BC_2_3: '23',
  BC_2_5: '25',
  BC_3_0: '30',
}

const text = (value: string | null | undefined) => value ?? ''
const number = (value: number | null | undefined) => value ?? ''

function resetDataRows(sheet: XLSX.WorkSheet) {
  for (const key of Object.keys(sheet)) {
    if (!key.startsWith('!') && XLSX.utils.decode_cell(key).r > 0) delete sheet[key]
  }
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1')
  range.e.r = 0
  sheet['!ref'] = XLSX.utils.encode_range(range)
}

function appendRows(workbook: XLSX.WorkBook, sheetName: string, rows: Record<string, string | number>[]) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return
  resetDataRows(sheet)
  if (rows.length) XLSX.utils.sheet_add_json(sheet, rows, { skipHeader: true, origin: 'A2' })
}

function createWorkbook(job: Job, documentType: CustomsDocumentType, template: Buffer) {
  const operational = job.operational
  if (!operational) throw new Error('Data operasional Job belum tersedia.')
  const invoice = operational.invoice
  const transport = job.transportDocument
  if (!invoice || !transport) throw new Error('Upload Invoice dan B/L/AWB yang telah berhasil diekstrak sebelum membuat BC 2.3.')
  if (documentType !== 'BC_2_3') {
    throw new Error('BC 2.5 dan BC 3.0 memerlukan alokasi item turunan dari BC 2.3; alokasi tersebut belum tersedia pada Job ini.')
  }

  const workbook = XLSX.read(template, { type: 'buffer', cellStyles: true })
  const ajuNumber = text(operational.customs[documentType].ajuNumber)
  const grossWeight = transport.grossWeightKg ?? invoice.totalGrossWeightKg
  const netWeight = transport.netWeightKg ?? invoice.totalNetWeightKg
  const totalAmount = invoice.totalAmount ?? invoice.items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0)

  appendRows(workbook, 'HEADER', [{
    'NOMOR AJU': ajuNumber,
    'KODE DOKUMEN': documentCodes[documentType],
    'NILAI BARANG': number(totalAmount),
    'ASURANSI': number(invoice.insuranceAmount),
    'FREIGHT': number(invoice.freightAmount),
    'CIF': number(totalAmount),
    'BRUTO': number(grossWeight),
    'NETTO': number(netWeight),
    'KODE VALUTA': text(invoice.currency),
    'KODE INCOTERM': text(invoice.incoterm),
  }])
  appendRows(workbook, 'ENTITAS', [
    ...(invoice.seller ? [{
      'NOMOR AJU': ajuNumber, 'SERI': 1, 'KODE ENTITAS': 5, 'NAMA ENTITAS': text(invoice.seller.name),
      'ALAMAT ENTITAS': text(invoice.seller.address), 'KODE NEGARA': text(invoice.seller.countryCode), 'NOMOR IDENTITAS': text(invoice.seller.taxId),
    }] : []),
    ...(invoice.buyer ? [{
      'NOMOR AJU': ajuNumber, 'SERI': 2, 'KODE ENTITAS': 3, 'NAMA ENTITAS': text(invoice.buyer.name),
      'ALAMAT ENTITAS': text(invoice.buyer.address), 'KODE NEGARA': text(invoice.buyer.countryCode), 'NOMOR IDENTITAS': text(invoice.buyer.taxId),
    }] : []),
    ...(transport.notifyParty ? [{
      'NOMOR AJU': ajuNumber, 'SERI': 3, 'KODE ENTITAS': 7, 'NAMA ENTITAS': text(transport.notifyParty.name),
      'ALAMAT ENTITAS': text(transport.notifyParty.address), 'KODE NEGARA': text(transport.notifyParty.countryCode), 'NOMOR IDENTITAS': text(transport.notifyParty.taxId),
    }] : []),
  ])
  appendRows(workbook, 'DOKUMEN', [
    ...(invoice.invoiceNumber ? [{ 'NOMOR AJU': ajuNumber, 'SERI': 1, 'KODE DOKUMEN': 380, 'NOMOR DOKUMEN': invoice.invoiceNumber, 'TANGGAL DOKUMEN': text(invoice.invoiceDate) }] : []),
    ...(transport.documentNumber ? [{ 'NOMOR AJU': ajuNumber, 'SERI': 2, 'KODE DOKUMEN': 705, 'NOMOR DOKUMEN': transport.documentNumber, 'TANGGAL DOKUMEN': text(transport.documentDate) }] : []),
  ])
  appendRows(workbook, 'PENGANGKUT', [{
    'NOMOR AJU': ajuNumber, 'SERI': 1, 'KODE CARA ANGKUT': job.transportDocumentType === 'AWB' ? 4 : 1,
    'NAMA PENGANGKUT': text(transport.vesselOrFlight ?? transport.carrier), 'NOMOR PENGANGKUT': text(transport.voyageOrFlightNumber),
  }])
  appendRows(workbook, 'KEMASAN', transport.packageCount !== null ? [{
    'NOMOR AJU': ajuNumber, 'SERI': 1, 'KODE KEMASAN': text(transport.packageType), 'JUMLAH KEMASAN': transport.packageCount,
    'MEREK': text(transport.marksAndNumbers),
  }] : [])
  appendRows(workbook, 'KONTAINER', transport.containers.map((container, index) => ({
    'NOMOR AJU': ajuNumber, 'SERI': index + 1, 'NOMOR KONTINER': text(container.containerNumber),
    'KODE UKURAN KONTAINER': text(container.size), 'KODE JENIS KONTAINER': text(container.type), 'NOMOR SEGEL': text(container.sealNumber),
  })))
  appendRows(workbook, 'BARANG', invoice.items.map((item, index) => ({
    'NOMOR AJU': ajuNumber, 'SERI BARANG': item.lineNumber ?? index + 1, 'HS': text(item.hsCode), 'KODE BARANG': text(item.itemCode),
    'URAIAN': item.description, 'KODE SATUAN': text(item.unit), 'JUMLAH SATUAN': number(item.quantity),
    'KODE KEMASAN': text(item.packageType ?? invoice.packageType), 'JUMLAH KEMASAN': number(item.packageCount),
    'NETTO': number(item.netWeightKg), 'BRUTO': number(item.grossWeightKg), 'CIF': number(item.lineTotal),
    'HARGA SATUAN': number(item.unitPrice), 'NILAI BARANG': number(item.lineTotal), 'KODE NEGARA ASAL': text(item.countryOfOrigin),
  })))
  appendRows(workbook, 'VERSI', [{ VERSI: '1.3' }])
  for (const sheetName of workbook.SheetNames.filter((name) => !['HEADER', 'ENTITAS', 'DOKUMEN', 'PENGANGKUT', 'KEMASAN', 'KONTAINER', 'BARANG', 'VERSI'].includes(name))) {
    appendRows(workbook, sheetName, [])
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

const requestSchema = z.object({
  jobId: z.string().min(1, 'Job wajib dipilih.'),
  documentType: z.enum(['BC_2_3', 'BC_2_5', 'BC_3_0', 'BC_2_7']),
})

/** Body `{ jobId, documentType }`. Job dimuat dari database — tidak pernah dipercaya dari klien. */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser()
    const { jobId, documentType } = requestSchema.parse(await request.json())
    if (!(documentType in templates)) {
      throw new ApiError(400, 'Template dokumen BC ini belum tersedia.')
    }
    const job = await getJob(currentUser, jobId)
    const template = await readFile(path.join(process.cwd(), 'docs', templates[documentType as CustomsDocumentType]))
    let workbook: Buffer
    try {
      workbook = createWorkbook(job, documentType as CustomsDocumentType, template)
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : 'File BC tidak dapat dibuat.')
    }
    const filename = jobFileName(job, documentType.replaceAll('_', '-'), 'xlsx')
    return new NextResponse(workbook, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
