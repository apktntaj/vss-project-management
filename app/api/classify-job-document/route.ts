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
  description: string
  hsCode: string | null
  unitPrice: number | null
  lineTotal: number | null
  currency: string | null
}

type InvoiceExtraction = { invoiceNumber: string | null; items: InvoiceItem[] }

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null

function normalizeInvoice(value: unknown): InvoiceExtraction | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const items = Array.isArray(input.items)
    ? input.items.flatMap((value): InvoiceItem[] => {
        if (!value || typeof value !== 'object') return []
        const item = value as Record<string, unknown>
        const description = text(item.description)
        return description ? [{
          description,
          hsCode: text(item.hsCode),
          unitPrice: amount(item.unitPrice),
          lineTotal: amount(item.lineTotal),
          currency: text(item.currency)?.toUpperCase() ?? null,
        }] : []
      })
    : []
  return { invoiceNumber: text(input.invoiceNumber), items }
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
              { text: `Classify this ${isPdf(file) ? 'PDF' : 'spreadsheet'} into exactly one documentType: BILL_OF_LADING, AIR_WAYBILL, COMMERCIAL_INVOICE, OTHER, or UNREADABLE. A packing list, customs document, certificate, receipt, or mixed document is OTHER unless it is primarily one of the first three. Return only JSON. Include documentType, confidence (number from 0 to 1), a short rationale in Indonesian, and invoice. Always try to extract invoice from the document even if documentType is OTHER: invoice has invoiceNumber and items. Each item must have description, hsCode, unitPrice, lineTotal, and currency. Use null when a value is not clearly printed; do not infer HS codes or prices. unitPrice and lineTotal must be numbers without currency symbols. Set invoice to null only when no invoice information is present.` },
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
    return NextResponse.json({
      classification,
      invoice: normalizeInvoice(parsed.invoice ?? (parsed.invoiceNumber || parsed.items ? parsed : null)),
    })
  } catch (error) {
    console.error('Document classification error:', error)
    return NextResponse.json({ error: 'Dokumen tidak dapat diklasifikasikan. Coba lagi atau gunakan PDF lain.' }, { status: 502 })
  }
}
