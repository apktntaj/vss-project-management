import type { JobInvoiceExtraction, JobTransportExtraction } from '@/lib/data-client'

export type DocumentComparisonStatus = 'MATCH' | 'DIFFERENT' | 'UNAVAILABLE'

export type DocumentComparison = {
  field: string
  label: string
  invoiceValue: string | number | null
  transportValue: string | number | null
  status: DocumentComparisonStatus
}

const normalizeText = (value: string) =>
  value
    .trim()
    .toLocaleUpperCase('id-ID')
    .replace(/[^\p{L}\p{N}]+/gu, '')

function compare(
  field: string,
  label: string,
  invoiceValue: string | number | null | undefined,
  transportValue: string | number | null | undefined,
): DocumentComparison {
  const invoice = invoiceValue ?? null
  const transport = transportValue ?? null
  if (invoice === null || transport === null) {
    return { field, label, invoiceValue: invoice, transportValue: transport, status: 'UNAVAILABLE' }
  }

  const matches = typeof invoice === 'number' && typeof transport === 'number'
    ? Math.abs(invoice - transport) <= 0.001
    : normalizeText(String(invoice)) === normalizeText(String(transport))

  return { field, label, invoiceValue: invoice, transportValue: transport, status: matches ? 'MATCH' : 'DIFFERENT' }
}

/**
 * Compares values that should agree between a commercial invoice and B/L or AWB.
 * Empty values are reported separately, so an absent Gemini extraction is never
 * presented as a document discrepancy.
 */
export function compareInvoiceWithTransport(
  invoice: JobInvoiceExtraction,
  transport: JobTransportExtraction,
): DocumentComparison[] {
  return [
    compare('shipper', 'Shipper / penjual', invoice.seller?.name, transport.shipper?.name),
    compare('consignee', 'Consignee / pembeli', invoice.buyer?.name, transport.consignee?.name),
    compare('grossWeight', 'Berat bruto (kg)', invoice.totalGrossWeightKg, transport.grossWeightKg),
    compare('netWeight', 'Berat netto (kg)', invoice.totalNetWeightKg, transport.netWeightKg),
    compare('packageCount', 'Jumlah kemasan', invoice.totalPackageCount, transport.packageCount),
    compare('packageType', 'Jenis kemasan', invoice.packageType, transport.packageType),
  ]
}
