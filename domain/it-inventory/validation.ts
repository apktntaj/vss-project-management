// Mengapa: skema Zod di batas route (konvensi repo — komponen tidak pernah menjalankan Zod).
// Dua bentuk divalidasi di sini: hasil parse BUP (route import) dan kumpulan entry jurnal
// (route export). Form manual bersifat sesi-klien; aturan bisnisnya (saldo tidak minus)
// dijalankan fungsi murni `validateEntryBalance` di ledger.ts.

import { z } from 'zod'

const nullableText = z.string().min(1).max(500).nullable()
const nullableNumber = z.number().finite().nullable()
const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD.')
  .nullable()
const nullableTimestamp = z.string().datetime().nullable()

export const bupBarangLineSchema = z.object({
  seri: z.number().int().min(0).nullable(),
  hsCode: nullableText,
  itemCode: nullableText,
  description: z.string().min(1, 'Uraian barang wajib ada pada setiap baris.'),
  brand: nullableText,
  type: nullableText,
  size: nullableText,
  unitCode: nullableText,
  quantity: z.number().finite().min(0, 'Jumlah barang tidak boleh negatif.'),
  netWeightKg: nullableNumber,
  grossWeightKg: nullableNumber,
  cifValue: nullableNumber,
  unitPrice: nullableNumber,
  lineValue: nullableNumber,
  countryCode: nullableText,
  sourceDocumentCode: nullableText,
  sourceRegistrationNumber: nullableText,
  sourceRegistrationDate: nullableDate,
  sourceLineSeri: z.number().int().min(0).nullable(),
})

export const bupDocumentSchema = z.object({
  fileName: z.string().min(1, 'Nama file wajib ada.'),
  documentCode: z.enum(['23', '25', '30'], {
    errorMap: () => ({ message: 'Demo ini hanya mendukung dokumen BC 2.3, BC 2.5, dan BC 3.0.' }),
  }),
  nomorAju: nullableText,
  nomorDaftar: nullableText,
  tanggalDaftar: nullableDate,
  kantor: nullableText,
  bruto: nullableNumber,
  netto: nullableNumber,
  cif: nullableNumber,
  currency: nullableText,
  ownerName: nullableText,
  invoiceNumber: nullableText,
  invoiceDate: nullableDate,
  uploadedAt: nullableTimestamp,
  items: z.array(bupBarangLineSchema).min(1, 'Dokumen tidak memiliki baris barang.'),
})

export const journalEntrySchema = z.object({
  id: z.string().min(1),
  entryDate: nullableDate,
  uploadedAt: nullableTimestamp,
  source: z.enum(['DOCUMENT', 'ADJUSTMENT']),
  direction: z.enum(['IN', 'OUT']),
  documentKey: z.string().min(1),
  documentCode: z.enum(['23', '25', '30']).nullable(),
  nomorDaftar: nullableText,
  tanggalDaftar: nullableDate,
  nomorAju: nullableText,
  invoiceNumber: nullableText,
  invoiceSeri: z.number().int().min(0).nullable(),
  adjustmentReason: z
    .enum(['STOCK_OPNAME', 'RUSAK', 'HILANG', 'KOREKSI', 'LAINNYA'])
    .nullable(),
  beritaAcaraNumber: nullableText,
  itemKey: z.string().min(1, 'Barang belum dipilih.'),
  hsCode: nullableText,
  description: z.string().min(1, 'Nama barang wajib diisi.'),
  itemCode: nullableText,
  // Satuan wajib pada form manual, tapi entry hasil parse BUP bisa tanpa satuan — skema di
  // batas route harus menerima keduanya.
  unitCode: nullableText,
  quantity: z.number().finite().positive('Jumlah harus lebih dari 0.'),
  unitPrice: nullableNumber,
  value: nullableNumber,
  currency: nullableText,
  ownerName: nullableText,
  sourceRef: nullableText,
})

export type BupDocumentInput = z.infer<typeof bupDocumentSchema>
export type JournalEntryInput = z.infer<typeof journalEntrySchema>
