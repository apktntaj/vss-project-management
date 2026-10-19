// Mengapa: IT Inventory dimodelkan sebagai PEMBUKUAN arus barang, bukan tabel stok gudang —
// setiap dokumen pabean yang diunggah menjadi satu transaksi jurnal, dan saldo selalu dihitung
// dari jurnal (tidak pernah diinput). Lapisan ini murni dan bebas teknologi: dipakai oleh parser
// server, route export, dan komponen UI tanpa dependensi satu sama lain.

/** Kode dokumen pabean yang didukung demo ini (kolom KODE DOKUMEN pada sheet HEADER BUP). */
export type BupDocumentCode = '23' | '25' | '30'

export const bupDocumentLabels: Record<BupDocumentCode, string> = {
  '23': 'BC 2.3',
  '25': 'BC 2.5',
  '30': 'BC 3.0',
}

/** Arah mutasi barang terhadap TPB, DIDAPATKAN dari jenis dokumen — bukan input pengguna. */
export type MovementDirection = 'IN' | 'OUT'

export const movementDirectionLabels: Record<MovementDirection, string> = {
  IN: 'Masuk',
  OUT: 'Keluar',
}

export function movementDirectionOf(code: BupDocumentCode): MovementDirection {
  // BC 2.3 = pemasukan ke TPB; BC 2.5 (pengeluaran untuk dipakai) dan BC 3.0 (ekspor) = pengeluaran.
  return code === '23' ? 'IN' : 'OUT'
}

/**
 * Satu baris barang pada sheet BARANG — hanya kolom yang dipakai pembukuan yang dibawa;
 * 70 kolom mentah BUP dirampingkan agar payload ke klien tetap kecil.
 */
export type BupBarangLine = {
  seri: number | null
  hsCode: string | null
  /** Kolom KODE BARANG; pada data nyata berisi referensi baris invoice (mis. S.01/IDW-VPN/086). */
  itemCode: string | null
  description: string
  brand: string | null
  type: string | null
  size: string | null
  unitCode: string | null
  quantity: number
  netWeightKg: number | null
  grossWeightKg: number | null
  cifValue: number | null
  unitPrice: number | null
  lineValue: number | null
  countryCode: string | null
  /** Jejak rantai dokumen: baris ini ditarik dari dokumen pabean asal berikut. */
  sourceDocumentCode: string | null
  sourceRegistrationNumber: string | null
  sourceRegistrationDate: string | null
  sourceLineSeri: number | null
}

/** Satu dokumen BUP yang telah diparse — ini "transaksi" dalam buku arus barang. */
export type BupDocument = {
  fileName: string
  documentCode: BupDocumentCode
  nomorAju: string | null
  /** Nomor pendaftaran (NOMOR DAFTAR) — elemen data yang diminta Lampiran R PER-6/BC/2023. */
  nomorDaftar: string | null
  tanggalDaftar: string | null
  kantor: string | null
  bruto: number | null
  netto: number | null
  cif: number | null
  currency: string | null
  /** Nama pemilik barang (ENTITAS kode 3) untuk ditampilkan pada rekap dokumen. */
  ownerName: string | null
  /** Stempel waktu posting ke buku (log aktivitas, Pasal 39) — BUKAN kunci urutan jurnal. */
  uploadedAt: string | null
  items: BupBarangLine[]
}

/** Baris jurnal: satu baris barang dari satu dokumen, dengan arah dan nilai. */
export type LedgerJournalRow = {
  documentKey: string
  fileName: string
  tanggalDaftar: string | null
  uploadedAt: string | null
  documentCode: BupDocumentCode
  nomorDaftar: string | null
  nomorAju: string | null
  direction: MovementDirection
  itemKey: string
  hsCode: string | null
  description: string
  unitCode: string | null
  quantityIn: number
  quantityOut: number
  unitPrice: number | null
  value: number | null
  /** Referensi dokumen asal (mis. "BC 2.3 000973 seri 12") bila baris membawa kolom asal. */
  sourceRef: string | null
}

/** "Akun" buku besar: satu jenis barang dengan saldo hasil agregasi jurnal. */
export type LedgerItem = {
  key: string
  hsCode: string | null
  description: string
  unitCode: string | null
  itemCode: string | null
  brand: string | null
  balanceQty: number
  balanceValue: number | null
}

/** Baris kartu stok: mutasi satu jenis barang dengan saldo berjalan (running balance). */
export type LedgerItemMovementRow = {
  tanggalDaftar: string | null
  documentCode: BupDocumentCode
  nomorDaftar: string | null
  quantityIn: number
  quantityOut: number
  runningQty: number
  value: number | null
  runningValue: number | null
}

export type LedgerDocumentRecap = {
  documentKey: string
  fileName: string
  documentCode: BupDocumentCode
  direction: MovementDirection
  nomorAju: string | null
  nomorDaftar: string | null
  tanggalDaftar: string | null
  ownerName: string | null
  lineCount: number
  totalQty: number
  totalValue: number | null
}

export type LedgerSummary = {
  totalDocuments: number
  itemTypes: number
  movementLines: number
  totalQtyIn: number
  totalQtyOut: number
  valueIn: number | null
  valueOut: number | null
  currency: string | null
}

export type Ledger = {
  journal: LedgerJournalRow[]
  items: LedgerItem[]
  documents: LedgerDocumentRecap[]
  summary: LedgerSummary
}
