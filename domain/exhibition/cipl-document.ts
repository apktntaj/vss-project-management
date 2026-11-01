import { z } from 'zod'

import { koliCollectionSchema, summarizeKoliCollections } from '@/domain/job/manifest'

const optionalText = z.string().trim().min(1).nullable().default(null)
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalDate = dateOnly.nullable().default(null)
const nonNegative = z.number().finite().min(0).nullable().default(null)

export const disposisiBarangs = ['RE_EXPORT', 'DISPOSED', 'GIVE_AWAY', 'TIDAK_DISEBUT'] as const
export type DisposisiBarang = (typeof disposisiBarangs)[number]
export const disposisiBarangLabels: Record<DisposisiBarang, string> = {
  RE_EXPORT: 'Re-export setelah pameran',
  DISPOSED: 'Dibuang atau terpakai',
  GIVE_AWAY: 'Diberikan atau dijual',
  TIDAK_DISEBUT: 'Tidak disebut di dokumen',
}

export const pihakDokumenSchema = z.object({
  name: z.string().trim().min(1),
  address: optionalText,
  countryCode: optionalText,
  taxId: optionalText,
})
export type PihakDokumen = z.infer<typeof pihakDokumenSchema>

export const barisBarangSchema = z.object({
  uraian: z.string().trim().min(1),
  merekModel: optionalText,
  kodeHs: optionalText,
  jumlah: z.number().finite().positive(),
  satuan: z.string().trim().min(1),
  nilaiSatuan: nonNegative,
  nilaiTotal: nonNegative,
  disposisi: z.enum(disposisiBarangs).default('TIDAK_DISEBUT'),
  refKoli: optionalText,
})
export type BarisBarang = z.infer<typeof barisBarangSchema>

export const entriExhibitorSchema = z.object({
  namaTertera: z.string().trim().min(1),
  exhibitorId: optionalText,
  hall: optionalText,
  booth: optionalText,
  koli: koliCollectionSchema,
  items: z.array(barisBarangSchema),
})
export type EntriExhibitor = z.infer<typeof entriExhibitorSchema>

export const ciplDocumentSchema = z.object({
  nomor: z.string().trim().min(1),
  tanggal: optionalDate,
  pengirim: pihakDokumenSchema,
  penerima: pihakDokumenSchema,
  namaPameran: optionalText,
  incoterm: optionalText,
  mataUang: optionalText,
  infoKontainer: optionalText,
  nilaiTotalDeklarasi: nonNegative,
  entri: z.array(entriExhibitorSchema),
  itemsBelumTerpetakan: z.array(barisBarangSchema).default([]),
})
export type CiplDocument = z.infer<typeof ciplDocumentSchema>

export const versiCiplSchema = z.object({
  nomorVersi: z.number().int().min(1),
  diterimaPada: optionalDate,
  berkasSumber: optionalText,
  isi: ciplDocumentSchema,
  catatanRevisi: optionalText,
})
export type VersiCipl = z.infer<typeof versiCiplSchema>

/** Header blok manifest dari satu dokumen CIPL: semuanya turunan, tidak tersimpan. */
export function totalDokumen(doc: CiplDocument) {
  const koli = summarizeKoliCollections(doc.entri.map((entri) => entri.koli))
  const nilaiTotal = [...doc.entri.flatMap((entri) => entri.items), ...doc.itemsBelumTerpetakan].reduce(
    (sum, item) => sum + (item.nilaiTotal ?? 0),
    0,
  )
  return { entri: doc.entri.length, koli: koli.totalCount, beratKg: koli.weightKg, nilaiTotal }
}
