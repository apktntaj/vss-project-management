// Mengapa: skema Zod di batas route (konvensi repo — komponen tidak pernah menjalankan Zod).
// Parser server menghasilkan BupDocument; skema ini memastikan bentuknya valid sebelum dipakai
// membangun buku atau dikembalikan ke klien. Toleran terhadap kolom opsional yang kosong
// (export BUP antar instalasi bervariasi), tapi tegas untuk identitas dokumen dan baris barang.

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
  uploadedAt: nullableTimestamp,
  items: z.array(bupBarangLineSchema).min(1, 'Dokumen tidak memiliki baris barang.'),
})

export type BupDocumentInput = z.infer<typeof bupDocumentSchema>
