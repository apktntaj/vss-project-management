// Mengapa: IT Inventory dimodelkan sebagai PEMBUKUAN arus barang, bukan tabel stok gudang.
// Kosakata yang disepakati: **journal** = buku kumpulan catatan; **entry** = satu catatan
// perpindahan barang. Setiap entry punya dua dimensi: ARUS (arah efek ke saldo: masuk/keluar)
// dan SUMBER (dokumen pabean atau penyesuaian). Lapisan ini murni dan bebas teknologi.

/** Kode dokumen pabean yang didukung demo ini (kolom KODE DOKUMEN pada sheet HEADER BUP). */
export type BupDocumentCode = '23' | '25' | '30'

export const bupDocumentLabels: Record<BupDocumentCode, string> = {
  '23': 'BC 2.3',
  '25': 'BC 2.5',
  '30': 'BC 3.0',
}

/** Arah efek entry terhadap saldo barang. */
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
 * Sumber entry. Pasal 39 ayat (1) huruf e mewajibkan pencatatan pemasukan, pengeluaran, WIP,
 * PENYESUAIAN, dan stock opname — penyesuaian adalah entry di DALAM jurnal yang tidak
 * didasari dokumen pabean, melainkan berita acara/kejadian internal (selisih opname, rusak,
 * hilang, koreksi).
 */
export type JournalSource = 'DOCUMENT' | 'ADJUSTMENT'

export const journalSourceLabels: Record<JournalSource, string> = {
  DOCUMENT: 'Dokumen pabean',
  ADJUSTMENT: 'Penyesuaian',
}

export type AdjustmentReason = 'STOCK_OPNAME' | 'RUSAK' | 'HILANG' | 'KOREKSI' | 'LAINNYA'

export const adjustmentReasonLabels: Record<AdjustmentReason, string> = {
  STOCK_OPNAME: 'Stock opname',
  RUSAK: 'Rusak',
  HILANG: 'Hilang',
  KOREKSI: 'Koreksi catatan',
  LAINNYA: 'Lainnya',
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

/** Satu dokumen BUP yang telah diparse — sumber BULK dari sekumpulan entry. */
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
  /**
   * Bukti pemasukan/pengeluaran dari sheet DOKUMEN: commercial invoice (kode 380) — nomor &
   * tanggal. Elemen "Bukti Penerimaan/Pengeluaran Barang" pada format laporan PER-24/BC/2023.
   */
  invoiceNumber: string | null
  invoiceDate: string | null
  /** Stempel waktu posting ke buku (log aktivitas, Pasal 39) — BUKAN kunci urutan jurnal. */
  uploadedAt: string | null
  items: BupBarangLine[]
}

/**
 * Satu catatan jurnal (entry). Ini satu-satunya bentuk penyimpanan buku: tabel jurnal, kartu
 * stok, dan rekap dokumen semuanya TURUNAN dari kumpulan entry.
 *
 * `entryDate` adalah TANGGAL PERPINDAHAN (bukan jam ketikan): mode bulk mengambilnya dari
 * tanggal daftar dokumen; mode manual dari form (default hari input). `uploadedAt` adalah
 * stempel log yang tidak tampil di kolom tanggal.
 */
export type JournalEntry = {
  id: string
  entryDate: string | null
  uploadedAt: string | null
  source: JournalSource
  direction: MovementDirection
  /** Kunci grup dokumen untuk rekap & penghapusan (mis. nama file BUP atau id manual). */
  documentKey: string
  documentCode: BupDocumentCode | null
  nomorDaftar: string | null
  tanggalDaftar: string | null
  nomorAju: string | null
  /** Bukti: nomor invoice (sumber dokumen) atau nomor berita acara (penyesuaian). */
  invoiceNumber: string | null
  /** Urutan barang pada dokumen sumber (SERI BARANG pada BUP). */
  invoiceSeri: number | null
  adjustmentReason: AdjustmentReason | null
  beritaAcaraNumber: string | null
  itemKey: string
  hsCode: string | null
  description: string
  unitCode: string | null
  /**
   * Kode barang per baris dari BUP (kolom KODE BARANG, mis. S.01/IDW-VPN/086) — identitas
   * barang versi badan usaha; null untuk barang yang belum punya kode.
   */
  itemCode: string | null
  /** Jumlah selalu positif; arah efek ke saldo ditentukan `direction`. */
  quantity: number
  unitPrice: number | null
  value: number | null
  currency: string | null
  ownerName: string | null
  /** Referensi dokumen asal (mis. "BC 2.3 000973 seri 12") bila baris BUP membawa kolom asal. */
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
  entryDate: string | null
  source: JournalSource
  documentCode: BupDocumentCode | null
  nomorDaftar: string | null
  invoiceNumber: string | null
  invoiceSeri: number | null
  beritaAcaraNumber: string | null
  adjustmentReason: AdjustmentReason | null
  direction: MovementDirection
  quantity: number
  runningQty: number
  value: number | null
  runningValue: number | null
}

export type LedgerDocumentRecap = {
  documentKey: string
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
  totalEntries: number
  itemTypes: number
  totalQtyIn: number
  totalQtyOut: number
  valueIn: number | null
  valueOut: number | null
  currency: string | null
}

export type Ledger = {
  entries: JournalEntry[]
  items: LedgerItem[]
  documents: LedgerDocumentRecap[]
  summary: LedgerSummary
}
