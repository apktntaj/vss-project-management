import * as XLSX from 'xlsx'
import type { JobDocumentParty, JobInvoiceExtraction, JobInvoiceItem, JobTransportContainer, JobTransportExtraction } from '@/domain/exhibition/source-documents'

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
const MAX_SPREADSHEET_TEXT_LENGTH = 80_000
const MODEL = 'gemini-3.5-flash-lite'
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

function normalizeInvoice(value: unknown): JobInvoiceExtraction | null {
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

function normalizeTransport(value: unknown): JobTransportExtraction | null {
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

function spreadsheetText(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellFormula: false, cellNF: false })
  const content = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    return `Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet, { blankrows: false })}`
  }).join('\n\n')
  if (!content.trim()) throw new DocumentExtractionError('Spreadsheet tidak berisi sel yang dapat dibaca.', 400)
  return content.slice(0, MAX_SPREADSHEET_TEXT_LENGTH)
}

function normalizeClassification(value: unknown): DocumentClassification {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const documentType = documentTypes.includes(input.documentType as DocumentType)
    ? (input.documentType as DocumentType)
    : 'UNREADABLE'
  const confidence = typeof input.confidence === 'number' && Number.isFinite(input.confidence)
    ? Math.max(0, Math.min(1, input.confidence))
    : 0
  const rationale = typeof input.rationale === 'string' && input.rationale.trim()
    ? input.rationale.trim().slice(0, 280)
    : null
  return { documentType, confidence, rationale }
}

export async function extractDocument(file: File): Promise<DocumentExtraction> {
  assertSupportedDocumentFile(file)
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new DocumentExtractionError('GEMINI_API_KEY belum dikonfigurasi.', 503)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const input = isPdf(file)
      ? { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } }
      : { text: `Spreadsheet content:\n${spreadsheetText(buffer)}` }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Classify this ${isPdf(file) ? 'PDF' : 'spreadsheet'} into exactly one documentType: BILL_OF_LADING, AIR_WAYBILL, COMMERCIAL_INVOICE, OTHER, or UNREADABLE. A packing list, customs document, certificate, receipt, or mixed document is OTHER unless it is primarily one of the first three. Return only JSON with documentType, confidence (number 0-1), a short Indonesian rationale, invoice, and transport. Always try to extract invoice even from OTHER. invoice is null only when no invoice information is printed; otherwise return invoiceNumber, invoiceDate (YYYY-MM-DD), seller and buyer (name, address, countryCode ISO 2, taxId), currency, incoterm, incotermLocation, totalAmount, freightAmount, insuranceAmount, totalGrossWeightKg, totalNetWeightKg, totalPackageCount, packageType, and items. Transport is null unless the document is a B/L or AWB; otherwise return documentNumber, documentDate, carrier, vesselOrFlight, voyageOrFlightNumber, bookingNumber, shipper, consignee, notifyParty, portOfLoading, portOfDischarge, placeOfReceipt, placeOfDelivery, etd, eta, packageCount, packageType, marksAndNumbers, grossWeightKg, netWeightKg, volumeM3, and containers.`,
            },
            input,
          ],
        }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    })
    if (!response.ok) throw new DocumentExtractionError('Dokumen tidak dapat diproses oleh Gemini.', 502)
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const responseText = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text
    if (!responseText) throw new DocumentExtractionError('Gemini tidak mengembalikan data dokumen.', 502)
    const parsed = JSON.parse(responseText) as Record<string, unknown>
    const classification = normalizeClassification(parsed)
    return {
      classification,
      invoice: normalizeInvoice(parsed.invoice ?? (parsed.invoiceNumber || parsed.items ? parsed : null)),
      transport: classification.documentType === 'BILL_OF_LADING' || classification.documentType === 'AIR_WAYBILL'
        ? normalizeTransport(parsed.transport)
        : null,
    }
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError('Dokumen tidak dapat diklasifikasikan. Coba lagi atau gunakan PDF lain.', 502)
  }
}
