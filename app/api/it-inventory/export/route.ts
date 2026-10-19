import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { z } from 'zod'

import { requireCurrentUser } from '@/features/auth'
import { bupDocumentSchema } from '@/domain/it-inventory/validation'
import { buildItemLedgerRows, buildLedger } from '@/domain/it-inventory/ledger'
import { bupDocumentLabels } from '@/domain/it-inventory/types'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  documents: z.array(bupDocumentSchema).min(1, 'Belum ada dokumen untuk diekspor.'),
})

function aoaSheet(rows: (string | number | null)[][], widths: number[]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = widths.map((wch) => ({ wch }))
  return sheet
}

/**
 * Susun laporan Excel dari buku arus barang di sesi klien: Jurnal Mutasi (kronologis per
 * dokumen), Kartu Stok (saldo berjalan per jenis barang), dan Rekap Dokumen. Kolom mengikuti
 * elemen data Lampiran R PER-6/BC/2023 (jenis dokumen, nomor & tanggal pendaftaran, jumlah,
 * satuan). Workbook dibangun dari payload — tidak ada data yang disimpan server.
 */
export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser()
    const { documents } = bodySchema.parse(await request.json())
    const ledger = buildLedger(documents)

    const journalRows: (string | number | null)[][] = [
      ['Tanggal Daftar', 'Waktu Input', 'Dokumen', 'Nomor Daftar', 'Nomor AJU', 'Jenis Barang', 'HS', 'Satuan', 'Masuk', 'Keluar', 'Harga Satuan', 'Total', 'Dokumen Asal'],
    ]
    for (const row of ledger.journal) {
      journalRows.push([
        row.tanggalDaftar ?? '',
        row.uploadedAt ?? '',
        bupDocumentLabels[row.documentCode],
        row.nomorDaftar ?? '',
        row.nomorAju ?? '',
        row.description,
        row.hsCode ?? '',
        row.unitCode ?? '',
        row.quantityIn || '',
        row.quantityOut || '',
        row.unitPrice ?? '',
        row.value ?? '',
        row.sourceRef ?? '',
      ])
    }

    const kartuRows: (string | number | null)[][] = [
      ['Jenis Barang', 'HS', 'Satuan', 'Tanggal', 'Dokumen', 'Nomor Daftar', 'Masuk', 'Keluar', 'Saldo', 'Nilai Saldo'],
    ]
    for (const item of ledger.items) {
      for (const row of buildItemLedgerRows(ledger, item.key)) {
        kartuRows.push([
          item.description,
          item.hsCode ?? '',
          item.unitCode ?? '',
          row.tanggalDaftar ?? '',
          bupDocumentLabels[row.documentCode],
          row.nomorDaftar ?? '',
          row.quantityIn || '',
          row.quantityOut || '',
          row.runningQty,
          row.runningValue ?? '',
        ])
      }
    }

    const recapRows: (string | number | null)[][] = [
      ['Dokumen', 'Nomor AJU', 'Nomor Daftar', 'Tanggal Daftar', 'Arah', 'Pemilik Barang', 'Jumlah Baris', 'Total Kuantitas', 'Total Nilai'],
    ]
    for (const doc of ledger.documents) {
      recapRows.push([
        bupDocumentLabels[doc.documentCode],
        doc.nomorAju ?? '',
        doc.nomorDaftar ?? '',
        doc.tanggalDaftar ?? '',
        doc.direction === 'IN' ? 'Masuk' : 'Keluar',
        doc.ownerName ?? '',
        doc.lineCount,
        doc.totalQty,
        doc.totalValue ?? '',
      ])
    }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, aoaSheet(journalRows, [14, 18, 9, 12, 26, 44, 12, 9, 10, 10, 13, 13, 24]), 'Jurnal Mutasi')
    XLSX.utils.book_append_sheet(workbook, aoaSheet(kartuRows, [44, 12, 9, 12, 9, 12, 10, 10, 10, 13]), 'Kartu Stok')
    XLSX.utils.book_append_sheet(workbook, aoaSheet(recapRows, [9, 26, 12, 14, 8, 30, 12, 15, 14]), 'Rekap Dokumen')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="it-inventory-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
