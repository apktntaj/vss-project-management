import { z } from 'zod'

/**
 * Model data job ala inward manifest (lihat docs/domain/job-manifest-data-definitions.md).
 * Semua definisi bebas teknologi; parser/UI memakai Zod schema yang sama.
 */

const optionalText = z.string().trim().min(1).nullable()
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus format YYYY-MM-DD.')
const nonNegative = z.number().finite().min(0).nullable()

// ---------- Atomic / enumeration ----------

export const containerSizes = ['K20', 'K40', 'K40HQ'] as const
export type ContainerSize = (typeof containerSizes)[number]

export const containerSizeLabels: Record<ContainerSize, string> = {
  K20: "20'",
  K40: "40'",
  K40HQ: "40'HQ",
}

export const milestoneKinds = [
  'ETA',
  'SKEP',
  'SPPB',
  'STRIPPING_SELESAI',
  'MASUK_BONDED',
  'BAHANDLE_SELESAI',
  'PERIKSA_SELESAI',
  'DO_READY',
] as const
export type MilestoneKind = (typeof milestoneKinds)[number]

export const milestoneKindLabels: Record<MilestoneKind, string> = {
  ETA: 'ETA',
  SKEP: 'Skep',
  SPPB: 'SPPB',
  STRIPPING_SELESAI: 'Selesai stripping',
  MASUK_BONDED: 'Masuk bonded',
  BAHANDLE_SELESAI: 'Selesai bahandle',
  PERIKSA_SELESAI: 'Selesai periksa',
  DO_READY: 'DO ready',
}

export const operationalNoteKinds = ['ANOMALI_BARANG', 'PENAHANAN', 'LAINNYA'] as const
export type OperationalNoteKind = (typeof operationalNoteKinds)[number]

export const operationalNoteKindLabels: Record<OperationalNoteKind, string> = {
  ANOMALI_BARANG: 'Anomali barang',
  PENAHANAN: 'Penahanan',
  LAINNYA: 'Catatan',
}

// ---------- Structure dasar ----------

export const containerSchema = z.object({
  containerNumber: optionalText,
  size: z.enum(containerSizes),
  sealNumber: optionalText,
})
export type ShippingContainer = z.infer<typeof containerSchema>

export const koliDimensionSchema = z.object({
  lengthCm: z.number().finite().min(0),
  widthCm: z.number().finite().min(0),
  heightCm: z.number().finite().min(0),
})
export type KoliDimension = z.infer<typeof koliDimensionSchema>

export const koliSchema = z.object({
  label: optionalText,
  dimension: koliDimensionSchema.nullable(),
  volumeCbm: nonNegative,
  weightKg: nonNegative,
})
export type Koli = z.infer<typeof koliSchema>

export const koliCollectionSchema = z
  .object({
    totalCount: z.number().int().min(0),
    details: z.array(koliSchema),
  })
  .refine((collection) => collection.details.length <= collection.totalCount, {
    message: 'Rincian koli tidak boleh melebihi jumlah total koli.',
  })
export type KoliCollection = z.infer<typeof koliCollectionSchema>

export const milestoneSchema = z.object({
  kind: z.enum(milestoneKinds),
  date: dateOnly,
  /** Nomor surat hanya bermakna untuk SKEP/SPPB (contoh S-622/WBC.08/2026). */
  documentNumber: optionalText,
})
export type Milestone = z.infer<typeof milestoneSchema>

export const operationalNoteSchema = z.object({
  kind: z.enum(operationalNoteKinds),
  text: z.string().trim().min(1),
})
export type OperationalNote = z.infer<typeof operationalNoteSchema>

// ---------- Itemization ----------

export const transportDocumentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('BL'), number: z.string().trim().min(1, 'Nomor B/L wajib diisi.') }),
  z.object({ kind: z.literal('AWB'), number: z.string().trim().min(1, 'Nomor AWB wajib diisi.') }),
])
export type InwardTransportDocument = z.infer<typeof transportDocumentSchema>

export const loadConfigurationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('LCL') }),
  z.object({ kind: z.literal('FCL'), containers: z.array(containerSchema).min(1, 'FCL minimal satu kontainer.') }),
])
export type LoadConfiguration = z.infer<typeof loadConfigurationSchema>

// ---------- Aggregate job / exhibitor ----------

export const inwardManifestSchema = z.object({
  transportDocument: transportDocumentSchema,
  loadConfiguration: loadConfigurationSchema,
  milestones: z.array(milestoneSchema),
  notes: z.array(operationalNoteSchema),
})
export type InwardManifest = z.infer<typeof inwardManifestSchema>

export const returnModeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('FCL'), containers: z.array(containerSchema).min(1, 'Kepulangan kontainer minimal satu unit.') }),
  z.object({ kind: z.literal('LCL'), koliCount: z.number().int().min(0) }),
])
export type ReturnMode = z.infer<typeof returnModeSchema>

export const jobReturnSchema = z.object({
  mode: returnModeSchema,
  destination: optionalText,
  shippingLine: optionalText,
  bookingNumber: optionalText,
  vessel: optionalText,
  etd: dateOnly.nullable(),
  eta: dateOnly.nullable(),
  notes: z.array(operationalNoteSchema),
})
export type JobReturn = z.infer<typeof jobReturnSchema>

export const exhibitorLogisticsSchema = z.object({
  hall: optionalText,
  booth: optionalText,
  koli: koliCollectionSchema,
  notes: z.array(operationalNoteSchema),
})
export type ExhibitorLogistics = z.infer<typeof exhibitorLogisticsSchema>

// ---------- Pertanyaan turunan (fungsi murni) ----------

export type KoliSummary = {
  totalCount: number
  detailedCount: number
  weightKg: number
  volumeCbm: number
}

export function summarizeKoli(collection: Pick<KoliCollection, 'totalCount' | 'details'>): KoliSummary {
  return {
    totalCount: collection.totalCount,
    detailedCount: collection.details.length,
    weightKg: collection.details.reduce((sum, koli) => sum + (koli.weightKg ?? 0), 0),
    volumeCbm: collection.details.reduce((sum, koli) => sum + (koli.volumeCbm ?? 0), 0),
  }
}

/** Gabungan koli beberapa peserta untuk header blok manifest (total PKG/KGM/CBM). */
export function summarizeKoliCollections(
  collections: ReadonlyArray<Pick<KoliCollection, 'totalCount' | 'details'> | null | undefined>,
): KoliSummary {
  return collections
    .map((collection) => summarizeKoli(collection ?? { totalCount: 0, details: [] }))
    .reduce<KoliSummary>(
      (total, summary) => ({
        totalCount: total.totalCount + summary.totalCount,
        detailedCount: total.detailedCount + summary.detailedCount,
        weightKg: Math.round((total.weightKg + summary.weightKg) * 1000) / 1000,
        volumeCbm: Math.round((total.volumeCbm + summary.volumeCbm) * 1000) / 1000,
      }),
      { totalCount: 0, detailedCount: 0, weightKg: 0, volumeCbm: 0 },
    )
}

export function findMilestone(milestones: ReadonlyArray<Milestone>, kind: MilestoneKind): Milestone | null {
  return milestones.find((milestone) => milestone.kind === kind) ?? null
}

export function containerLabel(container: ShippingContainer): string {
  return [containerSizeLabels[container.size], container.containerNumber].filter(Boolean).join(' · ')
}
