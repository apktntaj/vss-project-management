import type { JobDocumentParty, JobInvoiceExtraction, JobInvoiceItem, JobTransportContainer, JobTransportExtraction } from '@/domain/exhibition/source-documents'
import { MAX_DOCUMENT_SIZE } from '@/lib/server/extraction/config'

const spreadsheetExtensions = new Set(['xls', 'xlsx', 'xlsm', 'xlsb', 'xltx', 'xltm'])

export const documentTypes = [
  'BILL_OF_LADING',
  'AIR_WAYBILL',
  'COMMERCIAL_INVOICE',
  'OTHER',
  'UNREADABLE',
] as const

export type DocumentType = (typeof documentTypes)[number]
export type DocumentClassification = {
  documentType: DocumentType
  confidence: number
  rationale: string | null
}

export type DocumentExtraction = {
  classification: DocumentClassification
  invoice: JobInvoiceExtraction | null
  transport: JobTransportExtraction | null
}

export class DocumentExtractionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 502 | 503,
  ) {
    super(message)
  }
}

function extension(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || extension(file) === 'pdf'
}

export function assertSupportedDocumentFile(file: File) {
  if (!isPdf(file) && !spreadsheetExtensions.has(extension(file))) {
    throw new DocumentExtractionError('File harus berupa PDF atau Excel.', 400)
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new DocumentExtractionError('Ukuran dokumen melebihi batas 10 MB.', 413)
  }
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const amount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const wholeNumber = (value: unknown) => {
  const parsed = amount(value)
  return parsed !== null && Number.isInteger(parsed) ? parsed : null
}
const countryCode = (value: unknown) => text(value)?.toUpperCase() ?? null
const date = (value: unknown) => {
  const parsed = text(value)
  return parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : null
}

function normalizeParty(value: unknown): JobDocumentParty | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const party = {
    name: text(input.name),
    address: text(input.address),
    countryCode: countryCode(input.countryCode),
    taxId: text(input.taxId),
  }
  return Object.values(party).some(Boolean) ? party : null
}

export function normalizeInvoice(value: unknown): JobInvoiceExtraction | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const items = Array.isArray(input.items)
    ? input.items.flatMap((value): JobInvoiceItem[] => {
        if (!value || typeof value !== 'object') return []
        const item = value as Record<string, unknown>
        const description = text(item.description)
        return description
          ? [{
              lineNumber: wholeNumber(item.lineNumber),
              itemCode: text(item.itemCode),
              description,
              hsCode: text(item.hsCode),
              quantity: amount(item.quantity),
              unit: text(item.unit)?.toUpperCase() ?? null,
              unitPrice: amount(item.unitPrice),
              lineTotal: amount(item.lineTotal),
              currency: text(item.currency)?.toUpperCase() ?? null,
              grossWeightKg: amount(item.grossWeightKg),
              netWeightKg: amount(item.netWeightKg),
              countryOfOrigin: countryCode(item.countryOfOrigin),
              packageCount: wholeNumber(item.packageCount),
              packageType: text(item.packageType)?.toUpperCase() ?? null,
            }]
          : []
      })
    : []
  return {
    invoiceNumber: text(input.invoiceNumber),
    invoiceDate: date(input.invoiceDate),
    seller: normalizeParty(input.seller),
    buyer: normalizeParty(input.buyer),
    currency: text(input.currency)?.toUpperCase() ?? null,
    incoterm: text(input.incoterm)?.toUpperCase() ?? null,
    incotermLocation: text(input.incotermLocation),
    totalAmount: amount(input.totalAmount),
    freightAmount: amount(input.freightAmount),
    insuranceAmount: amount(input.insuranceAmount),
    totalGrossWeightKg: amount(input.totalGrossWeightKg),
    totalNetWeightKg: amount(input.totalNetWeightKg),
    totalPackageCount: wholeNumber(input.totalPackageCount),
    packageType: text(input.packageType)?.toUpperCase() ?? null,
    items,
  }
}

export function normalizeTransport(value: unknown): JobTransportExtraction | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const containers = Array.isArray(input.containers)
    ? input.containers.flatMap((value): JobTransportContainer[] => {
        if (!value || typeof value !== 'object') return []
        const item = value as Record<string, unknown>
        const container = {
          containerNumber: text(item.containerNumber),
          size: text(item.size),
          type: text(item.type),
          sealNumber: text(item.sealNumber),
        }
        return Object.values(container).some(Boolean) ? [container] : []
      })
    : []
  return {
    documentNumber: text(input.documentNumber),
    documentDate: date(input.documentDate),
    carrier: text(input.carrier),
    vesselOrFlight: text(input.vesselOrFlight),
    voyageOrFlightNumber: text(input.voyageOrFlightNumber),
    bookingNumber: text(input.bookingNumber),
    shipper: normalizeParty(input.shipper),
    consignee: normalizeParty(input.consignee),
    notifyParty: normalizeParty(input.notifyParty),
    portOfLoading: text(input.portOfLoading),
    portOfDischarge: text(input.portOfDischarge),
    placeOfReceipt: text(input.placeOfReceipt),
    placeOfDelivery: text(input.placeOfDelivery),
    etd: date(input.etd),
    eta: date(input.eta),
    packageCount: wholeNumber(input.packageCount),
    packageType: text(input.packageType)?.toUpperCase() ?? null,
    marksAndNumbers: text(input.marksAndNumbers),
    grossWeightKg: amount(input.grossWeightKg),
    netWeightKg: amount(input.netWeightKg),
    volumeM3: amount(input.volumeM3),
    containers,
  }
}
