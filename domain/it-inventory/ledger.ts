// Mengapa: jantung demo ini — pembukuan arus barang sebagai fungsi MURNI. Semua tampilan
// (jurnal, kartu stok, rekap dokumen) adalah turunan dari hasil `buildLedger`; tidak ada saldo
// yang disimpan atau diedit langsung. Selaras semangat Pasal 39 PER-6/BC/2023: pencatatan
// berkelanjutan atas mutasi, dan laporan dihitung dari mutasi tersebut.

import {
  bupDocumentLabels,
  movementDirectionOf,
  type BupBarangLine,
  type BupDocument,
  type Ledger,
  type LedgerDocumentRecap,
  type LedgerItem,
  type LedgerItemMovementRow,
  type LedgerJournalRow,
} from './types'

/**
 * Identitas "akun" (jenis barang): HS + uraian + satuan yang dinormalisasi. Pasal 39 huruf f–g
 * mensyaratkan pencatatan per jenis barang dengan kode berbeda — fungsi ini adalah "kode" itu.
 * Uraian dinormalisasi (trim, spasi ganda dirapatkan, huruf besar) agar baris yang sama dari
 * dokumen berbeda (mis. BC 2.3 lalu BC 2.5) jatuh ke akun yang sama.
 */
export function itemKeyOf(hsCode: string | null, description: string, unitCode: string | null): string {
  const hs = hsCode?.trim() || '-'
  const uraian = description.trim().replace(/\s+/g, ' ').toUpperCase()
  const satuan = (unitCode?.trim() || '-').toUpperCase()
  return `${hs}|${uraian}|${satuan}`
}

function lineKeyOf(line: BupBarangLine): string {
  return itemKeyOf(line.hsCode, line.description, line.unitCode)
}

function lineValueOf(line: BupBarangLine): number | null {
  return line.lineValue ?? line.cifValue ?? null
}

function sourceRefOf(line: BupBarangLine): string | null {
  if (!line.sourceDocumentCode) return null
  const label = bupDocumentLabels[line.sourceDocumentCode as keyof typeof bupDocumentLabels]
  const parts = [label ?? `BC ${line.sourceDocumentCode}`, line.sourceRegistrationNumber]
  if (line.sourceLineSeri != null) parts.push(`seri ${line.sourceLineSeri}`)
  const ref = parts.filter(Boolean).join(' ')
  return ref || null
}

/** Dokumen diurutkan kronologis per tanggal daftar (null terakhir), stabil terhadap urutan unggah. */
function sortDocuments(documents: BupDocument[]): BupDocument[] {
  return [...documents].sort((a, b) => {
    const ta = a.tanggalDaftar ?? '9999-12-31'
    const tb = b.tanggalDaftar ?? '9999-12-31'
    if (ta !== tb) return ta < tb ? -1 : 1
    return 0
  })
}

/**
 * Bangun buku arus barang dari kumpulan dokumen BUP: jurnal kronologis, saldo per jenis barang,
 * rekap per dokumen, dan ringkasan. Satu-satunya sumber kebenaran untuk seluruh tampilan.
 */
export function buildLedger(documents: BupDocument[]): Ledger {
  const journal: LedgerJournalRow[] = []
  const items = new Map<string, LedgerItem>()
  const docs: LedgerDocumentRecap[] = []
  let totalQtyIn = 0
  let totalQtyOut = 0
  let valueIn: number | null = null
  let valueOut: number | null = null
  let currency: string | null = null

  for (const doc of sortDocuments(documents)) {
    const direction = movementDirectionOf(doc.documentCode)
    if (!currency && doc.currency) currency = doc.currency

    let docQty = 0
    let docValue: number | null = null
    for (const line of doc.items) {
      const itemKey = lineKeyOf(line)
      const value = lineValueOf(line)
      const existing = items.get(itemKey)
      if (!existing) {
        items.set(itemKey, {
          key: itemKey,
          hsCode: line.hsCode,
          description: line.description,
          unitCode: line.unitCode,
          itemCode: line.itemCode,
          brand: line.brand,
          balanceQty: 0,
          balanceValue: value != null ? 0 : null,
        })
      } else if (existing.balanceValue != null && value == null) {
        // Nilai tidak diketahui untuk salah satu mutasi akun ini → saldo nilai tak bisa dihitung penuh.
        existing.balanceValue = null
      }

      const quantityIn = direction === 'IN' ? line.quantity : 0
      const quantityOut = direction === 'OUT' ? line.quantity : 0
      journal.push({
        documentKey: doc.fileName,
        fileName: doc.fileName,
        tanggalDaftar: doc.tanggalDaftar,
        uploadedAt: doc.uploadedAt,
        documentCode: doc.documentCode,
        nomorDaftar: doc.nomorDaftar,
        nomorAju: doc.nomorAju,
        direction,
        itemKey,
        hsCode: line.hsCode,
        description: line.description,
        unitCode: line.unitCode,
        quantityIn,
        quantityOut,
        unitPrice: line.unitPrice,
        value,
        sourceRef: sourceRefOf(line),
      })

      const item = items.get(itemKey)!
      item.balanceQty += quantityIn - quantityOut
      if (item.balanceValue != null && value != null) item.balanceValue += value * (direction === 'IN' ? 1 : -1)

      totalQtyIn += quantityIn
      totalQtyOut += quantityOut
      if (value != null) {
        if (direction === 'IN') valueIn = (valueIn ?? 0) + value
        else valueOut = (valueOut ?? 0) + value
      }
      docQty += line.quantity
      docValue = value != null ? (docValue ?? 0) + value : docValue
    }

    docs.push({
      documentKey: doc.fileName,
      fileName: doc.fileName,
      documentCode: doc.documentCode,
      direction,
      nomorAju: doc.nomorAju,
      nomorDaftar: doc.nomorDaftar,
      tanggalDaftar: doc.tanggalDaftar,
      ownerName: doc.ownerName,
      lineCount: doc.items.length,
      totalQty: docQty,
      totalValue: docValue,
    })
  }

  return {
    journal,
    items: [...items.values()].sort((a, b) => a.description.localeCompare(b.description, 'id')),
    documents: docs,
    summary: {
      totalDocuments: docs.length,
      itemTypes: items.size,
      movementLines: journal.length,
      totalQtyIn,
      totalQtyOut,
      valueIn,
      valueOut,
      currency,
    },
  }
}

/**
 * Kartu stok satu jenis barang: mutasi kronologis dengan saldo berjalan — analogi buku besar
 * per akun pada pembukuan kas. `runningValue` null bila ada mutasi tanpa nilai.
 */
export function buildItemLedgerRows(ledger: Ledger, itemKey: string): LedgerItemMovementRow[] {
  const rows: LedgerItemMovementRow[] = []
  let runningQty = 0
  let runningValue: number | null = 0
  for (const row of ledger.journal) {
    if (row.itemKey !== itemKey) continue
    runningQty += row.quantityIn - row.quantityOut
    if (row.value != null && runningValue != null) {
      runningValue += row.value * (row.direction === 'IN' ? 1 : -1)
    } else {
      runningValue = null
    }
    rows.push({
      tanggalDaftar: row.tanggalDaftar,
      documentCode: row.documentCode,
      nomorDaftar: row.nomorDaftar,
      quantityIn: row.quantityIn,
      quantityOut: row.quantityOut,
      runningQty,
      value: row.value,
      runningValue,
    })
  }
  return rows
}
