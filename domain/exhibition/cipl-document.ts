import { z } from 'zod'

import {
  koliCollectionSchema,
  summarizeKoliCollections,
  type ExhibitorLogistics,
} from '@/domain/job/manifest'

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
  /** Id koli tempat barang ini dipak (nol/satu/banyak). Kosong = belum tertaut. */
  refKoliIds: z.array(z.string()).default([]),
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
  nomor: z.string().trim().min(1).nullable().default(null),
  tanggal: optionalDate,
  pengirim: pihakDokumenSchema.nullable().default(null),
  penerima: pihakDokumenSchema.nullable().default(null),
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
  const nilaiTotal = [
    ...doc.entri.flatMap((entri) => entri.items),
    ...doc.itemsBelumTerpetakan,
  ].reduce((sum, item) => sum + (item.nilaiTotal ?? 0), 0)
  return { entri: doc.entri.length, koli: koli.totalCount, beratKg: koli.weightKg, nilaiTotal }
}

/** Kepala dokumen hasil scan (bukti mentah sebelum jadi PihakDokumen) — kosong pada inward manifest. */
export type CiplDocumentHeader = {
  nomor: string | null
  tanggal: string | null
  pengirim: string | null
  penerima: string | null
  namaPameran: string | null
  incoterm: string | null
  mataUang: string | null
  infoKontainer: string | null
  nilaiTotalDeklarasi: number | null
}

/**
 * Rakit CiplDocument dari hasil scan — entri dari baris yang sudah diedit user
 * (nama/hall/booth/koli terbaru), item mengikuti barisnya. Null bila scan tidak
 * menemukan kepala dokumen maupun satu pun item (inward manifest murni).
 */
export function buildCiplDocument(
  header: CiplDocumentHeader | null,
  entries: Array<{ name: string; logistics: ExhibitorLogistics; items: BarisBarang[] }>,
  itemsBelumTerpetakan: BarisBarang[],
): CiplDocument | null {
  const hasItems =
    entries.some((entri) => entri.items.length > 0) || itemsBelumTerpetakan.length > 0
  if (!header && !hasItems) return null
  return ciplDocumentSchema.parse({
    nomor: header?.nomor ?? null,
    tanggal: header?.tanggal ?? null,
    pengirim: header?.pengirim ? { name: header.pengirim } : null,
    penerima: header?.penerima ? { name: header.penerima } : null,
    namaPameran: header?.namaPameran ?? null,
    incoterm: header?.incoterm ?? null,
    mataUang: header?.mataUang ?? null,
    infoKontainer: header?.infoKontainer ?? null,
    nilaiTotalDeklarasi: header?.nilaiTotalDeklarasi ?? null,
    entri: entries.map((entri) => ({
      namaTertera: entri.name,
      hall: entri.logistics.hall,
      booth: entri.logistics.booth,
      koli: entri.logistics.koli,
      items: entri.items,
    })),
    itemsBelumTerpetakan,
  })
}
