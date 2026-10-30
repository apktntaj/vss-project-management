import 'server-only'

import { CONFIDENCE_THRESHOLD, LLM_TIMEOUT_MS } from '../config'
import { DocumentExtractionError, LLM_FAILED_MESSAGE, LLM_UNAVAILABLE_MESSAGE } from '../errors'
import { isPdf } from '../file-guard'
import { parseSpreadsheet } from '../deterministic/xlsx-parser'
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

export const EXTRACTION_PROMPT =
  'Classify this document into exactly one documentType from: CIPL_COMBINED, PACKING_LIST, COMMERCIAL_INVOICE, BILL_OF_LADING, AIR_WAYBILL, SUPPORTING_DOCUMENT, UNREADABLE. ' +
  'A combined invoice & packing list is CIPL_COMBINED; a document whose primary purpose is listing packages, quantities, and weights is PACKING_LIST; a document stating commercial values (prices, totals, incoterms) is COMMERCIAL_INVOICE; a sea transport receipt is BILL_OF_LADING; an air transport document is AIR_WAYBILL; certificates, receipts, permits, letters, or other supporting papers are SUPPORTING_DOCUMENT; unreadable scans are UNREADABLE. ' +
  'Return only JSON with documentType, confidence (number 0-1), a short Indonesian rationale, invoice, and transport. Always try to extract invoice even from SUPPORTING_DOCUMENT. ' +
  'invoice is null only when no invoice information is printed; otherwise return invoiceNumber, invoiceDate (YYYY-MM-DD), seller and buyer (name, address, countryCode ISO 2, taxId), currency, incoterm, incotermLocation, totalAmount, freightAmount, insuranceAmount, totalGrossWeightKg, totalNetWeightKg, totalPackageCount, packageType, and items (lineNumber, itemCode, description, hsCode, quantity, unit, unitPrice, lineTotal, currency, grossWeightKg, netWeightKg, countryOfOrigin, packageCount, packageType). ' +
  'Transport is null unless the document is a B/L or AWB; otherwise return documentNumber, documentDate, carrier, vesselOrFlight, voyageOrFlightNumber, bookingNumber, shipper, consignee, notifyParty, portOfLoading, portOfDischarge, placeOfReceipt, placeOfDelivery, etd, eta, packageCount, packageType, marksAndNumbers, grossWeightKg, netWeightKg, volumeM3, and containers (containerNumber, size, type, sealNumber).'

/** Input dokumen utk provider LLM: PDF native (base64) atau teks (spreadsheet CSV). */
export async function documentInputForLlm(file: File): Promise<{ pdfBase64: string } | { text: string }> {
  if (isPdf(file)) return { pdfBase64: Buffer.from(await file.arrayBuffer()).toString('base64') }
  const parsed = await parseSpreadsheet(file)
  return { text: parsed.text }
}

export async function fetchJsonWithTimeout(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new DocumentExtractionError(`${LLM_FAILED_MESSAGE} (${response.status})`, 503, 'LLM_EXTRACTION_FAILED')
    return await response.json()
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    const aborted = error instanceof Error && error.name === 'AbortError'
    throw new DocumentExtractionError(LLM_FAILED_MESSAGE, 503, aborted ? 'LLM_EXTRACTION_TIMEOUT' : 'LLM_EXTRACTION_FAILED')
  } finally {
    clearTimeout(timer)
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
