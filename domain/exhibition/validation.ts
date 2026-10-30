import { z } from 'zod'

import type { CiplItem, CiplVersion, CustomsJob, CustomsJobStatus, JobAllocation, Shipment, ShipmentAllocation } from './types'

export type ValidationIssue = { path: string; message: string }
export type Validation<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] }
const invalid = <T>(...issues: ValidationIssue[]): Validation<T> => ({ ok: false, issues })
const valid = <T>(value: T): Validation<T> => ({ ok: true, value })

export function validateDateRange(startsOn: string, endsOn: string): Validation<void> {
  return /^\d{4}-\d{2}-\d{2}$/.test(startsOn) && /^\d{4}-\d{2}-\d{2}$/.test(endsOn) && endsOn >= startsOn
    ? valid(undefined) : invalid({ path: 'endsOn', message: 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.' })
}
export function validateCiplVersionReady(version: CiplVersion): Validation<CiplVersion> {
  const issues: ValidationIssue[] = []
  if (!version.items.length) issues.push({ path: 'items', message: 'Versi CIPL READY harus memiliki minimal satu item.' })
  version.items.forEach((item, index) => {
    if (!item.description.trim()) issues.push({ path: `items.${index}.description`, message: 'Deskripsi item wajib diisi.' })
    if (!(item.quantity > 0)) issues.push({ path: `items.${index}.quantity`, message: 'Quantity harus positif.' })
    if (!item.unit.trim()) issues.push({ path: `items.${index}.unit`, message: 'Unit wajib diisi.' })
  })
  return issues.length ? invalid(...issues) : valid(version)
}
function validateAllocations(items: CiplItem[], existing: readonly ShipmentAllocation[], candidate: readonly ShipmentAllocation[]) {
  const issues: ValidationIssue[] = []
  for (const [index, allocation] of candidate.entries()) {
    const item = items.find((value) => value.id === allocation.ciplItemId)
    if (!item) issues.push({ path: `allocations.${index}.ciplItemId`, message: 'Item tidak berasal dari versi CIPL sumber.' })
    else if (item.unit !== allocation.unit) issues.push({ path: `allocations.${index}.unit`, message: 'Unit alokasi harus sama dengan unit CIPL.' })
    if (!(allocation.quantity > 0)) issues.push({ path: `allocations.${index}.quantity`, message: 'Quantity harus positif.' })
    if (item && existing.filter((x) => x.ciplItemId === item.id).reduce((sum, x) => sum + x.quantity, 0) + allocation.quantity > item.quantity)
      issues.push({ path: `allocations.${index}.quantity`, message: 'Total alokasi melebihi quantity CIPL.' })
  }
  return issues
}
export function validateShipmentAllocation(version: CiplVersion, existingShipments: readonly Shipment[], candidate: readonly ShipmentAllocation[]): Validation<readonly ShipmentAllocation[]> {
  const existing = existingShipments.filter((shipment) => shipment.sourceCiplVersionId === version.id).flatMap((shipment) => shipment.allocations)
  const issues = validateAllocations(version.items, existing, candidate)
  return issues.length ? invalid(...issues) : valid(candidate)
}
export function validateJobAllocation(shipment: Shipment, existingJobs: readonly CustomsJob[], candidate: readonly JobAllocation[]): Validation<readonly JobAllocation[]> {
  const issues: ValidationIssue[] = []
  for (const [index, allocation] of candidate.entries()) {
    const shipmentAllocation = shipment.allocations.find((value) => value.ciplItemId === allocation.ciplItemId)
    if (!shipmentAllocation) issues.push({ path: `allocations.${index}.ciplItemId`, message: 'Item tidak dialokasikan ke shipment induk.' })
    else {
      if (shipmentAllocation.unit !== allocation.unit) issues.push({ path: `allocations.${index}.unit`, message: 'Unit alokasi harus sama dengan unit shipment.' })
      const used = existingJobs.flatMap((job) => job.allocations).filter((value) => value.ciplItemId === allocation.ciplItemId).reduce((sum, value) => sum + value.quantity, 0)
      if (used + allocation.quantity > shipmentAllocation.quantity) issues.push({ path: `allocations.${index}.quantity`, message: 'Total alokasi Job melebihi quantity shipment.' })
    }
    if (!(allocation.quantity > 0)) issues.push({ path: `allocations.${index}.quantity`, message: 'Quantity harus positif.' })
  }
  return issues.length ? invalid(...issues) : valid(candidate)
}
const progression: CustomsJobStatus[] = ['DRAFT', 'PREPARING', 'SUBMITTED', 'REGISTERED', 'RELEASED', 'COMPLETED']
export function validateJobTransition(previous: CustomsJobStatus, next: CustomsJobStatus, evidence: readonly unknown[], reason?: string): Validation<CustomsJobStatus> {
  if (next === previous) return valid(next)
  if (next === 'ON_HOLD' || next === 'CANCELLED') return valid(next)
  const normal = progression.indexOf(next) === progression.indexOf(previous) + 1
  if (normal) return valid(next)
  if (reason?.trim() && evidence.length) return valid(next)
  return invalid({ path: 'status', message: 'Perubahan status mundur atau pembukaan kembali memerlukan alasan dan evidence.' })
}

export const extractDocumentSchema = z
  .object({
    ownerType: z.enum(['SHIPMENT', 'CIPL_VERSION'], {
      errorMap: () => ({ message: 'Tipe pemilik dokumen tidak didukung.' }),
    }),
    ownerId: z.string().trim().min(1, 'Pemilik dokumen tidak ditemukan.'),
    intendedKind: z.enum(['CIPL', 'TRANSPORT', 'SUPPORTING'], {
      errorMap: () => ({ message: 'Jenis dokumen tidak didukung.' }),
    }),
    mode: z.enum(['DETERMINISTIC', 'LLM'], {
      errorMap: () => ({ message: 'Mode ekstraksi tidak didukung.' }),
    }).default('DETERMINISTIC'),
    attachmentId: z.string().trim().min(1, 'Lampiran wajib dipilih.').optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === 'LLM' && !value.attachmentId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['attachmentId'], message: 'Lampiran wajib dipilih.' })
    }
  })

export const supportingDocumentSchema = z
  .object({
    ownerType: z.enum(['SHIPMENT', 'CIPL_VERSION']),
    ownerId: z.string().trim().min(1, 'Pemilik dokumen tidak ditemukan.'),
    label: z.string().trim().max(120, 'Label dokumen pendukung maksimal 120 karakter.').optional(),
  })
  .strict()

export const ciplVersionFromExtractionSchema = z
  .object({
    ciplId: z.string().trim().min(1, 'CIPL wajib dipilih.'),
    source: z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('COMBINED'),
        documentType: z.literal('CIPL_COMBINED', {
          errorMap: () => ({ message: 'Sumber tunggal harus dokumen CIPL gabungan, atau gabungkan Packing List dan Commercial Invoice.' }),
        }),
        attachmentId: z.string().trim().min(1),
      }),
      z.object({
        kind: z.literal('SPLIT'),
        packingListAttachmentId: z.string().trim().min(1),
        invoiceAttachmentId: z.string().trim().min(1),
      }),
    ]),
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1, 'Deskripsi item wajib diisi.'),
          quantity: z.number().positive('Quantity harus positif.'),
          unit: z.string().trim().min(1, 'Unit wajib diisi.'),
          unitValue: z.number().nullable(),
          currency: z.string().trim().nullable(),
          grossWeightKg: z.number().nullable(),
          netWeightKg: z.number().nullable(),
          countryOfOrigin: z.string().trim().nullable(),
        }),
      )
      .min(1, 'Versi CIPL harus memiliki minimal satu item.'),
  })
  .strict()

export type CiplVersionFromExtractionInput = z.infer<typeof ciplVersionFromExtractionSchema>

export const markShipmentReadySchema = z
  .object({
    shipmentId: z.string().trim().min(1, 'Shipment wajib dipilih.'),
  })
  .strict()
