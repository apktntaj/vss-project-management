import 'server-only'

import type {
  CiplMergeInput,
  CiplMergeResult,
  JobInvoiceExtraction,
  JobInvoiceItem,
} from '@/domain/exhibition/source-documents'

const normalizeDescription = (description: string) => description.replace(/\s+/g, ' ').trim().toLowerCase()

/** Kunci padanan = deskripsi ternormalisasi + kuantitas sama; null bila kuantitas tidak dapat dibandingkan. */
function matchKey(item: JobInvoiceItem): string | null {
  if (item.quantity === null || !Number.isFinite(item.quantity)) return null
  return `${normalizeDescription(item.description)}\u0000${item.quantity}`
}

function mergeRow(invoiceItem: JobInvoiceItem, packingListItem: JobInvoiceItem): JobInvoiceItem {
  return {
    ...invoiceItem,
    itemCode: invoiceItem.itemCode ?? packingListItem.itemCode,
    hsCode: invoiceItem.hsCode ?? packingListItem.hsCode,
    grossWeightKg: invoiceItem.grossWeightKg ?? packingListItem.grossWeightKg,
    netWeightKg: invoiceItem.netWeightKg ?? packingListItem.netWeightKg,
    packageCount: invoiceItem.packageCount ?? packingListItem.packageCount,
    packageType: invoiceItem.packageType ?? packingListItem.packageType,
  }
}

/**
 * Menggabungkan Packing List + Commercial Invoice menjadi satu hasil CIPL (R5.2–R5.4).
 * Nilai komersial (unitPrice/lineTotal/currency) selalu diambil dari Commercial Invoice.
 */
export function mergePackingListAndInvoice(input: CiplMergeInput): CiplMergeResult {
  const invoiceRows = new Map<string, JobInvoiceItem[]>()
  for (const item of input.invoice.items) {
    const key = matchKey(item)
    if (!key) return { ok: false, unmatched: [{ source: 'COMMERCIAL_INVOICE', description: item.description }] }
    invoiceRows.set(key, [...(invoiceRows.get(key) ?? []), item])
  }

  const unmatched: { source: 'PACKING_LIST' | 'COMMERCIAL_INVOICE'; description: string }[] = []
  const consumed = new Map<string, number>()
  const mergedItems: JobInvoiceItem[] = []

  for (const item of input.packingList.items) {
    const key = matchKey(item)
    if (!key) {
      unmatched.push({ source: 'PACKING_LIST', description: item.description })
      continue
    }
    const candidates = invoiceRows.get(key) ?? []
    const used = consumed.get(key) ?? 0
    if (used >= candidates.length) {
      unmatched.push({ source: 'PACKING_LIST', description: item.description })
      continue
    }
    consumed.set(key, used + 1)
    mergedItems.push(mergeRow(candidates[used], item))
  }
  for (const [key, items] of invoiceRows) {
    for (const item of items.slice(consumed.get(key) ?? 0)) {
      unmatched.push({ source: 'COMMERCIAL_INVOICE', description: item.description })
    }
  }

  if (unmatched.length) return { ok: false, unmatched }

  const merged: JobInvoiceExtraction = {
    ...input.invoice,
    items: mergedItems,
    totalGrossWeightKg: input.invoice.totalGrossWeightKg ?? input.packingList.totalGrossWeightKg,
    totalNetWeightKg: input.invoice.totalNetWeightKg ?? input.packingList.totalNetWeightKg,
    totalPackageCount: input.invoice.totalPackageCount ?? input.packingList.totalPackageCount,
    packageType: input.invoice.packageType ?? input.packingList.packageType,
  }
  return { ok: true, merged }
}
