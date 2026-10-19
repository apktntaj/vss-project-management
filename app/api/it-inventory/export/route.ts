import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { z } from 'zod'

import { requireCurrentUser } from '@/features/auth'
import { journalEntrySchema } from '@/domain/it-inventory/validation'
import { buildItemLedgerRows, buildLedger } from '@/domain/it-inventory/ledger'
import {
  adjustmentReasonLabels,
  bupDocumentLabels,
  journalSourceLabels,
  movementDirectionLabels,
  type JournalEntry,
} from '@/domain/it-inventory/types'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  entries: z.array(journalEntrySchema).min(1, 'Jurnal masih kosong — tidak ada yang diekspor.'),
})

function aoaSheet(rows: (string | number | null)[][], widths: number[]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = widths.map((wch) => ({ wch }))
  return sheet
}

/** Keterangan satu entry: alasan+berita acara untuk penyesuaian, jejak dokumen asal untuk BUP. */
function entryNote(entry: JournalEntry): string {
  if (entry.source === 'ADJUSTMENT') {
    const reason = entry.adjustmentReason ? adjustmentReasonLabels[entry.adjustmentReason] : null
    return [reason, entry.beritaAcaraNumber].filter(Boolean).join(' · ')
  }
  return entry.sourceRef ?? ''
}

/**
 * Susun laporan Excel dari jurnal di sesi klien: sheet Jurnal (buku kas barang per entry),
 * Kartu Stok (saldo berjalan per barang), dan Rekap Dokumen. Kolom mengikuti elemen data
 * Lampiran R PER-6/BC/2023 (jenis dokumen, nomor & tanggal pendaftaran, jumlah, satuan).
 * Workbook dibangun dari payload — tidak ada data yang disimpan server.
 */
export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser()
    const { entries } = bodySchema.parse(await request.json())
    const ledger = buildLedger(entries)

    const journalRows: (string | number | null)[][] = [
      ['Tanggal Entry', 'Waktu Input', 'Sumber', 'Dokumen', 'Nomor Daftar', 'Tanggal Daftar', 'Nomor AJU', 'Bukti (Invoice/BA)', 'Seri', 'Nama Barang', 'HS', 'Satuan', 'Arus', 'Jumlah', 'Harga Satuan', 'Total', 'Keterangan'],
    ]
    for (const entry of ledger.entries) {
      journalRows.push([
        entry.entryDate ?? '',
        entry.uploadedAt ?? '',
        journalSourceLabels[entry.source],
        entry.documentCode ? bupDocumentLabels[entry.documentCode] : '',
        entry.nomorDaftar ?? '',
        entry.tanggalDaftar ?? '',
        entry.nomorAju ?? '',
        entry.invoiceNumber ?? entry.beritaAcaraNumber ?? '',
        entry.invoiceSeri ?? '',
        entry.description,
        entry.hsCode ?? '',
        entry.unitCode ?? '',
        movementDirectionLabels[entry.direction],
        entry.quantity,
        entry.unitPrice ?? '',
        entry.value ?? '',
        entryNote(entry),
      ])
    }

    const kartuRows: (string | number | null)[][] = [
      ['No', 'Nama Barang', 'Kode Barang', 'Satuan', 'Tanggal', 'Dokumen', 'Nomor Daftar', 'Bukti (Invoice/BA)', 'Seri', 'Masuk', 'Keluar', 'Saldo', 'Nilai Saldo'],
    ]
    for (const item of ledger.items) {
      const rows = buildItemLedgerRows(ledger, item.key)
      rows.forEach((row, index) => {
        kartuRows.push([
          index + 1,
          item.description,
          item.hsCode ?? '',
          item.unitCode ?? '',
          row.entryDate ?? '',
          row.documentCode ? bupDocumentLabels[row.documentCode] : row.source === 'ADJUSTMENT' ? 'Penyesuaian' : '',
          row.nomorDaftar ?? '',
          row.invoiceNumber ?? row.beritaAcaraNumber ?? '',
          row.invoiceSeri ?? '',
          row.direction === 'IN' ? row.quantity : '',
          row.direction === 'OUT' ? row.quantity : '',
          row.runningQty,
          row.runningValue ?? '',
        ])
      })
    }

    const recapRows: (string | number | null)[][] = [
      ['Dokumen', 'Nomor AJU', 'Nomor Daftar', 'Tanggal Daftar', 'Arah', 'Pemilik Barang', 'Jumlah Entry', 'Total Kuantitas', 'Total Nilai'],
    ]
    for (const doc of ledger.documents) {
      recapRows.push([
        bupDocumentLabels[doc.documentCode],
        doc.nomorAju ?? '',
        doc.nomorDaftar ?? '',
        doc.tanggalDaftar ?? '',
        movementDirectionLabels[doc.direction],
        doc.ownerName ?? '',
        doc.lineCount,
        doc.totalQty,
        doc.totalValue ?? '',
      ])
    }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, aoaSheet(journalRows, [13, 20, 12, 9, 12, 13, 26, 22, 7, 40, 12, 8, 9, 9, 12, 12, 24]), 'Jurnal')
    XLSX.utils.book_append_sheet(workbook, aoaSheet(kartuRows, [5, 40, 12, 8, 12, 10, 12, 22, 7, 9, 9, 10, 13]), 'Kartu Stok')
    XLSX.utils.book_append_sheet(workbook, aoaSheet(recapRows, [9, 26, 13, 14, 9, 30, 13, 15, 14]), 'Rekap Dokumen')

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
