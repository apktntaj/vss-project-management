import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { auth } from '@/auth'

export const runtime = 'nodejs'

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
const MAX_SPREADSHEET_TEXT_LENGTH = 80_000
const MODEL = 'gemini-3.5-flash-lite'

const documentTypes = [
  'BILL_OF_LADING',
  'AIR_WAYBILL',
  'COMMERCIAL_INVOICE',
  'OTHER',
  'UNREADABLE',
] as const

type DocumentType = (typeof documentTypes)[number]

type Classification = {
  documentType: DocumentType
  confidence: number
  rationale: string | null
}

type InvoiceItem = {
  lineNumber: number | null
  itemCode: string | null
  description: string
  hsCode: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  lineTotal: number | null
  currency: string | null
  grossWeightKg: number | null
  netWeightKg: number | null
  countryOfOrigin: string | null
  packageCount: number | null
  packageType: string | null
}

type DocumentParty = { name: string | null; address: string | null; countryCode: string | null; taxId: string | null }
type InvoiceExtraction = {
  invoiceNumber: string | null; invoiceDate: string | null; seller: DocumentParty | null; buyer: DocumentParty | null
  currency: string | null; incoterm: string | null; incotermLocation: string | null; totalAmount: number | null
  freightAmount: number | null; insuranceAmount: number | null; totalGrossWeightKg: number | null; totalNetWeightKg: number | null
  totalPackageCount: number | null; packageType: string | null; items: InvoiceItem[]
}
type TransportContainer = { containerNumber: string | null; size: string | null; type: string | null; sealNumber: string | null }
type TransportExtraction = {
  documentNumber: string | null; documentDate: string | null; carrier: string | null; vesselOrFlight: string | null
  voyageOrFlightNumber: string | null; bookingNumber: string | null; shipper: DocumentParty | null; consignee: DocumentParty | null
  notifyParty: DocumentParty | null; portOfLoading: string | null; portOfDischarge: string | null; placeOfReceipt: string | null
  placeOfDelivery: string | null; etd: string | null; eta: string | null; packageCount: number | null; packageType: string | null
  marksAndNumbers: string | null; grossWeightKg: number | null; netWeightKg: number | null; volumeM3: number | null; containers: TransportContainer[]
}

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
const wholeNumber = (value: unknown) => {
  const parsed = amount(value)
  return parsed !== null && Number.isInteger(parsed) ? parsed : null
}
const countryCode = (value: unknown) => text(value)?.toUpperCase() ?? null
const date = (value: unknown) => {
  const parsed = text(value)
  return parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : null
}

function normalizeParty(value: unknown): DocumentParty | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const party = { name: text(input.name), address: text(input.address), countryCode: countryCode(input.countryCode), taxId: text(input.taxId) }
  return Object.values(party).some(Boolean) ? party : null
}

function normalizeInvoice(value: unknown): InvoiceExtraction | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const items = Array.isArray(input.items)
    ? input.items.flatMap((value): InvoiceItem[] => {
        if (!value || typeof value !== 'object') return []
        const item = value as Record<string, unknown>
        const description = text(item.description)
        return description ? [{
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
        }] : []
      })
    : []
  return {
    invoiceNumber: text(input.invoiceNumber), invoiceDate: date(input.invoiceDate), seller: normalizeParty(input.seller), buyer: normalizeParty(input.buyer),
    currency: text(input.currency)?.toUpperCase() ?? null, incoterm: text(input.incoterm)?.toUpperCase() ?? null, incotermLocation: text(input.incotermLocation),
    totalAmount: amount(input.totalAmount), freightAmount: amount(input.freightAmount), insuranceAmount: amount(input.insuranceAmount),
    totalGrossWeightKg: amount(input.totalGrossWeightKg), totalNetWeightKg: amount(input.totalNetWeightKg), totalPackageCount: wholeNumber(input.totalPackageCount),
    packageType: text(input.packageType)?.toUpperCase() ?? null, items,
  }
}

function normalizeTransport(value: unknown): TransportExtraction | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const containers = Array.isArray(input.containers)
    ? input.containers.flatMap((value): TransportContainer[] => {
        if (!value || typeof value !== 'object') return []
        const item = value as Record<string, unknown>
        const container = { containerNumber: text(item.containerNumber), size: text(item.size), type: text(item.type), sealNumber: text(item.sealNumber) }
        return Object.values(container).some(Boolean) ? [container] : []
      })
    : []
  return {
    documentNumber: text(input.documentNumber), documentDate: date(input.documentDate), carrier: text(input.carrier), vesselOrFlight: text(input.vesselOrFlight),
    voyageOrFlightNumber: text(input.voyageOrFlightNumber), bookingNumber: text(input.bookingNumber), shipper: normalizeParty(input.shipper), consignee: normalizeParty(input.consignee),
    notifyParty: normalizeParty(input.notifyParty), portOfLoading: text(input.portOfLoading), portOfDischarge: text(input.portOfDischarge), placeOfReceipt: text(input.placeOfReceipt),
    placeOfDelivery: text(input.placeOfDelivery), etd: date(input.etd), eta: date(input.eta), packageCount: wholeNumber(input.packageCount), packageType: text(input.packageType)?.toUpperCase() ?? null,
    marksAndNumbers: text(input.marksAndNumbers), grossWeightKg: amount(input.grossWeightKg), netWeightKg: amount(input.netWeightKg), volumeM3: amount(input.volumeM3), containers,
  }
}

const spreadsheetExtensions = new Set(['xls', 'xlsx', 'xlsm', 'xlsb', 'xltx', 'xltm'])

function extension(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || extension(file) === 'pdf'
}

function spreadsheetText(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellFormula: false, cellNF: false })
  const content = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    return `Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet, { blankrows: false })}`
  }).join('\n\n')
  if (!content.trim()) throw new Error('Spreadsheet tidak berisi sel yang dapat dibaca.')
  return content.slice(0, MAX_SPREADSHEET_TEXT_LENGTH)
}

function normalizeClassification(value: unknown): Classification {
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

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY belum dikonfigurasi.' }, { status: 503 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File) || (!isPdf(file) && !spreadsheetExtensions.has(extension(file)))) {
    return NextResponse.json({ error: 'File harus berupa PDF atau Excel.' }, { status: 400 })
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return NextResponse.json({ error: 'Ukuran dokumen melebihi batas 10 MB.' }, { status: 413 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const input = isPdf(file)
      ? { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } }
      : { text: `Spreadsheet content:\n${spreadsheetText(buffer)}` }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Classify this ${isPdf(file) ? 'PDF' : 'spreadsheet'} into exactly one documentType: BILL_OF_LADING, AIR_WAYBILL, COMMERCIAL_INVOICE, OTHER, or UNREADABLE. A packing list, customs document, certificate, receipt, or mixed document is OTHER unless it is primarily one of the first three. Return only JSON with documentType, confidence (number 0-1), a short Indonesian rationale, invoice, and transport. Always try to extract invoice even from OTHER. invoice is null only when no invoice information is printed; otherwise return invoiceNumber, invoiceDate (YYYY-MM-DD), seller and buyer (name, address, countryCode ISO 2, taxId), currency, incoterm, incotermLocation, totalAmount, freightAmount, insuranceAmount, totalGrossWeightKg, totalNetWeightKg, totalPackageCount, packageType, and items. Each item has lineNumber, itemCode, description, hsCode, quantity, unit, unitPrice, lineTotal, currency, grossWeightKg, netWeightKg, countryOfOrigin ISO 2, packageCount, packageType. For BILL_OF_LADING or AIR_WAYBILL transport is required and has documentNumber, documentDate (YYYY-MM-DD), carrier, vesselOrFlight, voyageOrFlightNumber, bookingNumber, shipper/consignee/notifyParty (same party shape), portOfLoading, portOfDischarge, placeOfReceipt, placeOfDelivery, etd/eta (YYYY-MM-DD), packageCount, packageType, marksAndNumbers, grossWeightKg, netWeightKg, volumeM3, and containers (containerNumber, size, type, sealNumber). Set every unavailable field to null and containers/items to []. Do not infer HS codes, prices, dates, codes, weights, or parties.` },
              input,
            ],
          }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      },
    )
    if (!response.ok) {
      console.error('Gemini document classification failed:', response.status)
      return NextResponse.json({ error: 'Dokumen tidak dapat diproses oleh Gemini.' }, { status: 502 })
    }
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text
    if (!text) throw new Error('Gemini response tidak berisi JSON.')
    const parsed = JSON.parse(text) as Record<string, unknown>
    const classification = normalizeClassification(parsed)
    const transport = classification.documentType === 'BILL_OF_LADING' || classification.documentType === 'AIR_WAYBILL'
      ? normalizeTransport(parsed.transport)
      : null
    return NextResponse.json({
      classification,
      invoice: normalizeInvoice(parsed.invoice ?? (parsed.invoiceNumber || parsed.items ? parsed : null)),
      transport,
    })
  } catch (error) {
    console.error('Document classification error:', error)
    return NextResponse.json({ error: 'Dokumen tidak dapat diklasifikasikan. Coba lagi atau gunakan PDF lain.' }, { status: 502 })
  }
}
