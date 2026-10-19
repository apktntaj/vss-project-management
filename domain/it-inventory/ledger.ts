// Mengapa: jantung pembukuan arus barang sebagai fungsi MURNI. Jurnal adalah DAFTAR ENTRY —
// satu-satunya sumber kebenaran; saldo barang, kartu stok, dan rekap dokumen semuanya turunan.
// Selaras Pasal 39 PER-6/BC/2023: pencatatan berkelanjutan atas mutasi, laporan dihitung dari
// mutasi tersebut, dan penyesuaian adalah entry di dalam jurnal (bukan di luarnya).

import {
  bupDocumentLabels,
  movementDirectionOf,
  type BupBarangLine,
  type BupDocument,
  type JournalEntry,
  type Ledger,
  type LedgerDocumentRecap,
  type LedgerItem,
  type LedgerItemMovementRow,
} from './types'

/** Toleransi pembulatan angka pecahan (kg, nilai) saat membandingkan saldo dengan nol. */
const QTY_EPSILON = 1e-9

/**
 * Identitas "akun" (jenis barang): HS + nama + satuan yang dinormalisasi. Uraian dinormalisasi
 * (trim, spasi ganda dirapatkan, huruf besar) agar barang yang sama dari dokumen berbeda
 * (mis. BC 2.3 lalu BC 2.5) jatuh ke akun yang sama.
 */
export function itemKeyOf(hsCode: string | null, description: string, unitCode: string | null): string {
  const hs = hsCode?.trim() || '-'
  const nama = description.trim().replace(/\s+/g, ' ').toUpperCase()
  const satuan = (unitCode?.trim() || '-').toUpperCase()
  return `${hs}|${nama}|${satuan}`
}

function sourceRefOf(line: BupBarangLine): string | null {
  if (!line.sourceDocumentCode) return null
  const label = bupDocumentLabels[line.sourceDocumentCode as keyof typeof bupDocumentLabels]
  const parts = [label ?? `BC ${line.sourceDocumentCode}`, line.sourceRegistrationNumber]
  if (line.sourceLineSeri != null && line.sourceLineSeri > 0) {
    parts.push(`seri ${line.sourceLineSeri}`)
  }
  const ref = parts.filter(Boolean).join(' ')
  return ref || null
}

/**
 * Konversi satu dokumen BUP menjadi sekumpulan entry jurnal (mode BULK). Tanggal entry diambil
 * dari tanggal daftar dokumen — itulah tanggal perpindahan yang sebenarnya — sehingga urutan
 * buku tetap kronologis meski unggahan tidak berurutan.
 */
export function entriesFromBupDocument(document: BupDocument): JournalEntry[] {
  const direction = movementDirectionOf(document.documentCode)
  const fallbackDate = document.uploadedAt?.slice(0, 10) ?? null
  return document.items.map((line, index) => ({
    id: `${document.fileName}#${line.seri ?? index + 1}`,
    entryDate: document.tanggalDaftar ?? fallbackDate,
    uploadedAt: document.uploadedAt,
    source: 'DOCUMENT',
    direction,
    documentKey: document.fileName,
    documentCode: document.documentCode,
    nomorDaftar: document.nomorDaftar,
    tanggalDaftar: document.tanggalDaftar,
    nomorAju: document.nomorAju,
    invoiceNumber: document.invoiceNumber,
    invoiceSeri: line.seri,
    adjustmentReason: null,
    beritaAcaraNumber: null,
    itemKey: itemKeyOf(line.hsCode, line.description, line.unitCode),
    hsCode: line.hsCode,
    description: line.description,
    unitCode: line.unitCode,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    value: line.lineValue ?? line.cifValue ?? null,
    currency: document.currency,
    ownerName: document.ownerName,
    sourceRef: sourceRefOf(line),
  }))
}

function entrySortKey(entry: JournalEntry): string {
  // Kronologis per tanggal perpindahan; tanggal kosong diakhir; tie-break stempel log lalu id.
  return `${entry.entryDate ?? '9999-12-31'}|${entry.uploadedAt ?? ''}|${entry.id}`
}

/**
 * Bangun buku dari daftar entry: jurnal terurut kronologis, saldo per jenis barang, rekap per
 * dokumen pabean (penyesuaian tidak masuk rekap — ia bukan dokumen pabean), dan ringkasan.
 */
export function buildLedger(entries: JournalEntry[]): Ledger {
  const sorted = [...entries].sort((a, b) => {
    const ka = entrySortKey(a)
    const kb = entrySortKey(b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })

  const items = new Map<string, LedgerItem>()
  const documents = new Map<string, LedgerDocumentRecap>()
  let totalQtyIn = 0
  let totalQtyOut = 0
  let valueIn: number | null = null
  let valueOut: number | null = null
  let currency: string | null = null

  for (const entry of sorted) {
    const sign = entry.direction === 'IN' ? 1 : -1
    if (!currency && entry.currency) currency = entry.currency

    const existing = items.get(entry.itemKey)
    if (!existing) {
      items.set(entry.itemKey, {
        key: entry.itemKey,
        hsCode: entry.hsCode,
        description: entry.description,
        unitCode: entry.unitCode,
        itemCode: null,
        brand: null,
        balanceQty: 0,
        balanceValue: entry.value != null ? 0 : null,
      })
    } else if (existing.balanceValue != null && entry.value == null) {
      // Nilai tidak diketahui untuk salah satu mutasi akun ini → saldo nilai tak bisa dihitung penuh.
      existing.balanceValue = null
    }

    const item = items.get(entry.itemKey)!
    item.balanceQty += sign * entry.quantity
    if (item.balanceValue != null && entry.value != null) {
      item.balanceValue += sign * entry.value
    }

    if (entry.direction === 'IN') {
      totalQtyIn += entry.quantity
      if (entry.value != null) valueIn = (valueIn ?? 0) + entry.value
    } else {
      totalQtyOut += entry.quantity
      if (entry.value != null) valueOut = (valueOut ?? 0) + entry.value
    }

    if (entry.source === 'DOCUMENT' && entry.documentCode) {
      const recap = documents.get(entry.documentKey)
      if (!recap) {
        documents.set(entry.documentKey, {
          documentKey: entry.documentKey,
          documentCode: entry.documentCode,
          direction: entry.direction,
          nomorAju: entry.nomorAju,
          nomorDaftar: entry.nomorDaftar,
          tanggalDaftar: entry.tanggalDaftar,
          ownerName: entry.ownerName,
          lineCount: 1,
          totalQty: entry.quantity,
          totalValue: entry.value,
        })
      } else {
        recap.lineCount += 1
        recap.totalQty += entry.quantity
        if (entry.value != null) recap.totalValue = (recap.totalValue ?? 0) + entry.value
        if (!recap.nomorAju && entry.nomorAju) recap.nomorAju = entry.nomorAju
        if (!recap.ownerName && entry.ownerName) recap.ownerName = entry.ownerName
      }
    }
  }

  return {
    entries: sorted,
    items: [...items.values()].sort((a, b) => a.description.localeCompare(b.description, 'id')),
    documents: [...documents.values()],
    summary: {
      totalEntries: sorted.length,
      itemTypes: items.size,
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
 * per akun. `runningValue` null bila ada mutasi tanpa nilai.
 */
export function buildItemLedgerRows(ledger: Ledger, itemKey: string): LedgerItemMovementRow[] {
  const rows: LedgerItemMovementRow[] = []
  let runningQty = 0
  let runningValue: number | null = 0
  for (const entry of ledger.entries) {
    if (entry.itemKey !== itemKey) continue
    const sign = entry.direction === 'IN' ? 1 : -1
    runningQty += sign * entry.quantity
    if (entry.value != null && runningValue != null) {
      runningValue += sign * entry.value
    } else {
      runningValue = null
    }
    rows.push({
      entryDate: entry.entryDate,
      source: entry.source,
      documentCode: entry.documentCode,
      nomorDaftar: entry.nomorDaftar,
      invoiceNumber: entry.invoiceNumber,
      invoiceSeri: entry.invoiceSeri,
      beritaAcaraNumber: entry.beritaAcaraNumber,
      adjustmentReason: entry.adjustmentReason,
      direction: entry.direction,
      quantity: entry.quantity,
      runningQty,
      value: entry.value,
      runningValue,
    })
  }
  return rows
}

export type ValidationIssue = { message: string }

export type Validation<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] }

/**
 * Invariant "kondisi ideal": entry keluar (dokumen maupun penyesuaian) tidak boleh membuat
 * saldo akun barang menjadi negatif. Fungsi MURNI — dipanggil UI sebelum menambah entry.
 */
export function validateEntryBalance(
  entries: JournalEntry[],
  entry: JournalEntry,
): Validation<JournalEntry> {
  const sign = entry.direction === 'IN' ? 1 : -1
  const current = entries
    .filter((existing) => existing.itemKey === entry.itemKey)
    .reduce((sum, existing) => sum + (existing.direction === 'IN' ? 1 : -1) * existing.quantity, 0)
  const next = current + sign * entry.quantity
  if (next < -QTY_EPSILON) {
    const unit = entry.unitCode ? ` ${entry.unitCode}` : ''
    const nama = entry.description
    return {
      ok: false,
      issues: [
        {
          message: `Saldo ${nama} tidak cukup: tersedia ${current}${unit}, dicatat keluar ${entry.quantity}${unit}.`,
        },
      ],
    }
  }
  return { ok: true, value: entry }
}
