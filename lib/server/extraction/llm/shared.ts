import 'server-only'

import { CONFIDENCE_THRESHOLD, LLM_MAX_IMAGE_BYTES, LLM_MAX_IMAGE_PAGES, LLM_PAGE_MAX_EDGE } from '../config'
import { DocumentExtractionError, LLM_FAILED_MESSAGE, LLM_UNAVAILABLE_MESSAGE } from '../errors'
import { isPdf } from '../file-guard'
import { parseSpreadsheet } from '../deterministic/xlsx-parser'
import { parsePdfTextLayer } from '../deterministic/pdf-text-parser'
import { extractPageImages } from '../deterministic/pdf-images'
import { pnmToPng } from '../deterministic/pnm-to-png'
import { flattenExtractionFields } from '../deterministic/field-extractor'
import { normalizeInvoice, normalizeTransport } from '@/lib/server/document-extraction'
import {
  aggregateConfidence,
  bandForScore,
} from '../confidence-scorer'
import type {
  ConfidenceMap,
  DocumentClassificationType,
  ExtractionMethod,
  ExtractionResult,
  IntendedKind,
  JobInvoiceExtraction,
  JobTransportExtraction,
} from '@/domain/exhibition/source-documents'

export { LLM_FAILED_MESSAGE, LLM_UNAVAILABLE_MESSAGE }

const CLASSIFICATION_TYPES: DocumentClassificationType[] = [
  'CIPL_COMBINED',
  'PACKING_LIST',
  'COMMERCIAL_INVOICE',
  'BILL_OF_LADING',
  'AIR_WAYBILL',
  'SUPPORTING_DOCUMENT',
  'UNREADABLE',
]
const CIPL_TYPES: DocumentClassificationType[] = ['CIPL_COMBINED', 'PACKING_LIST', 'COMMERCIAL_INVOICE']
const TRANSPORT_TYPES: DocumentClassificationType[] = ['BILL_OF_LADING', 'AIR_WAYBILL']

/** Instruksi klasifikasi & ekstraksi B/L, AWB, dan CIPL — dikirim sebagai system prompt. */
export const EXTRACTION_PROMPT =
  'Classify this document into exactly one documentType from: CIPL_COMBINED, PACKING_LIST, COMMERCIAL_INVOICE, BILL_OF_LADING, AIR_WAYBILL, SUPPORTING_DOCUMENT, UNREADABLE. ' +
  'A combined invoice & packing list is CIPL_COMBINED; a document whose primary purpose is listing packages, quantities, and weights is PACKING_LIST; a document stating commercial values (prices, totals, incoterms) is COMMERCIAL_INVOICE; a sea transport receipt is BILL_OF_LADING; an air transport document is AIR_WAYBILL; certificates, receipts, permits, letters, or other supporting papers are SUPPORTING_DOCUMENT; unreadable scans are UNREADABLE. ' +
  'Return only JSON with documentType, confidence (number 0-1), a short Indonesian rationale, invoice, and transport. Always try to extract invoice even from SUPPORTING_DOCUMENT. ' +
  'invoice is null only when no invoice information is printed; otherwise return invoiceNumber, invoiceDate (YYYY-MM-DD), seller and buyer (name, address, countryCode ISO 2, taxId), currency, incoterm, incotermLocation, totalAmount, freightAmount, insuranceAmount, totalGrossWeightKg, totalNetWeightKg, totalPackageCount, packageType, and items (lineNumber, itemCode, description, hsCode, quantity, unit, unitPrice, lineTotal, currency, grossWeightKg, netWeightKg, countryOfOrigin, packageCount, packageType). ' +
  'Transport is null unless the document is a B/L or AWB; otherwise return documentNumber, documentDate, carrier, vesselOrFlight, voyageOrFlightNumber, bookingNumber, shipper, consignee, notifyParty, portOfLoading, portOfDischarge, placeOfReceipt, placeOfDelivery, etd, eta, packageCount, packageType, marksAndNumbers (shipping marks and container/package numbers only), goodsDescription (the description of the goods only), grossWeightKg, netWeightKg, volumeM3, loadType (exactly "LCL" or "FCL" for a sea B/L when printed or evident from the container details, otherwise null; always null for an AWB), and containers (containerNumber, size, type, sealNumber). ' +
  'Also return fieldConfidence: a flat object mapping each extracted field dot-path (for example invoice.invoiceNumber, transport.eta, invoice.items.0.description, transport.shipper.name) to a number 0-1 estimating confidence in that individual value; omit paths you did not extract.'

/** Pesan user pendek; isi instruksi ada di EXTRACTION_PROMPT (system). */
export const EXTRACTION_USER_PROMPT =
  'Classify and extract this document. Return only the JSON object described.'

export type LlmDocumentInput =
  | { pdfBase64: string }
  | { pagePngsBase64: string[] }
  | { text: string }

/** Input dokumen utk provider LLM: gambar halaman (PDF image-only), PDF native (base64), atau teks (spreadsheet CSV). */
export async function documentInputForLlm(file: File): Promise<LlmDocumentInput> {
  if (!isPdf(file)) return { text: (await parseSpreadsheet(file)).text }
  const pagePngsBase64 = await rasterizeImageOnlyPdf(file)
  if (pagePngsBase64) return { pagePngsBase64 }
  return { pdfBase64: Buffer.from(await file.arrayBuffer()).toString('base64') }
}

/** PDF tanpa lapisan teks → PNG per halaman (≤ LLM_PAGE_MAX_EDGE). null = kirim PDF asli. */
async function rasterizeImageOnlyPdf(file: File): Promise<string[] | null> {
  try {
    if ((await parsePdfTextLayer(file)).hasTextLayer) return null
    const { images, pageCount } = await extractPageImages(file, LLM_MAX_IMAGE_PAGES, LLM_PAGE_MAX_EDGE)
    if (!images.length || pageCount > LLM_MAX_IMAGE_PAGES || images.length < pageCount) return null
    const pngs = images.map((image) => pnmToPng(image.ppm))
    const total = pngs.reduce((sum, png) => sum + png.length, 0)
    if (total >= file.size || pngs.some((png) => png.length > LLM_MAX_IMAGE_BYTES)) return null
    return pngs.map((png) => png.toString('base64'))
  } catch (error) {
    console.warn('Rasterisasi PDF untuk LLM gagal; mengirim PDF asli.', { message: error instanceof Error ? error.message : 'unknown' })
    return null
  }
}

export function parseJsonPayload(rawText: string): Record<string, unknown> {
  const stripped = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    const parsed = JSON.parse(stripped)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    throw new DocumentExtractionError(LLM_FAILED_MESSAGE, 503, 'LLM_EXTRACTION_FAILED')
  }
}

const clamp01 = (value: unknown): number => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.min(1, number))
}

/** Skor per field yang dilaporkan LLM menimpa nilai turunan (confidence klasifikasi). */
function mergeReportedConfidence(fieldConfidence: ConfidenceMap, reported: unknown): void {
  if (!reported || typeof reported !== 'object' || Array.isArray(reported)) return
  for (const [path, score] of Object.entries(reported as Record<string, unknown>)) {
    if (path in fieldConfidence && typeof score === 'number' && Number.isFinite(score)) {
      fieldConfidence[path] = clamp01(score)
    }
  }
}

/** Menyusun Extraction_Result dari respons JSON LLM; confidence field = confidence klasifikasi. */
export function toExtractionResult(method: ExtractionMethod, payload: Record<string, unknown>): ExtractionResult {
  const documentType = CLASSIFICATION_TYPES.includes(payload.documentType as DocumentClassificationType)
    ? (payload.documentType as DocumentClassificationType)
    : 'UNREADABLE'
  const confidence = clamp01(payload.confidence)
  const classification = {
    documentType,
    confidence,
    needsUserConfirmation: confidence < CONFIDENCE_THRESHOLD,
    rationale:
      typeof payload.rationale === 'string' && payload.rationale.trim() ? payload.rationale.trim().slice(0, 280) : null,
  }
  const invoiceRaw = normalizeInvoice(payload.invoice ?? (payload.invoiceNumber || payload.items ? payload : null))
  const invoice = CIPL_TYPES.includes(documentType) ? invoiceRaw : null
  const transport = TRANSPORT_TYPES.includes(documentType) ? normalizeTransport(payload.transport) : null
  const fields = flattenExtractionFields(invoice, transport)
  const fieldConfidence: ConfidenceMap = {}
  for (const [path, value] of Object.entries(fields)) {
    fieldConfidence[path] = value === null || value === undefined || value === '' ? 0 : confidence
  }
  mergeReportedConfidence(fieldConfidence, payload.fieldConfidence)
  const aggregate = aggregateConfidence(fieldConfidence)
  return {
    method,
    classification,
    invoice,
    transport,
    fieldConfidence,
    aggregateConfidence: aggregate,
    band: bandForScore(aggregate),
  }
}

export type { JobInvoiceExtraction, JobTransportExtraction, IntendedKind }
