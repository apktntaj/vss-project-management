import 'server-only'

import type { ExtractionResult, IntendedKind } from '@/domain/exhibition/source-documents'
import { aggregateConfidence, bandForScore, scoreFields } from './confidence-scorer'
import { classifyDocument } from './classifier'
import { extractFields, flattenExtractionFields } from './deterministic/field-extractor'
import { parsePdfTextLayer } from './deterministic/pdf-text-parser'
import { parseSpreadsheet } from './deterministic/xlsx-parser'
import { runOcr } from './deterministic/ocr'
import { DocumentExtractionError, LLM_FAILED_MESSAGE, LLM_UNAVAILABLE_MESSAGE } from './errors'
import { assertSupportedDocumentFile, isSpreadsheet } from './file-guard'
import { resolveLlmProvider } from './llm/provider'

const CIPL_TYPES = ['CIPL_COMBINED', 'PACKING_LIST', 'COMMERCIAL_INVOICE']
const TRANSPORT_TYPES = ['BILL_OF_LADING', 'AIR_WAYBILL']

/** Lapis 1: deterministik tanpa LLM (R2.1); hasil tidak pernah dipersist parsial (R2.11). */
export async function runDeterministicExtraction(file: File, intendedKind: IntendedKind): Promise<ExtractionResult> {
  assertSupportedDocumentFile(file)
  let parsed
  if (isSpreadsheet(file)) {
    parsed = await parseSpreadsheet(file)
  } else {
    parsed = await parsePdfTextLayer(file)
    if (!parsed.hasTextLayer) parsed = await runOcr(file)
  }
  const { invoice, transport } = extractFields(parsed)
  const classification = classifyDocument(parsed, intendedKind)
  const attachInvoice = CIPL_TYPES.includes(classification.documentType) ? invoice : null
  const attachTransport = TRANSPORT_TYPES.includes(classification.documentType) ? transport : null
  const fieldConfidence = scoreFields(flattenExtractionFields(attachInvoice, attachTransport))
  const aggregate = aggregateConfidence(fieldConfidence)
  return {
    method: 'DETERMINISTIC',
    classification,
    invoice: attachInvoice,
    transport: attachTransport,
    fieldConfidence,
    aggregateConfidence: aggregate,
    band: bandForScore(aggregate),
  }
}

/** Lapis 2: LLM; hanya dijalankan bila diminta eksplisit dan provider terkonfigurasi (R3.3, R3.4). */
export async function runLlmExtraction(file: File): Promise<ExtractionResult> {
  assertSupportedDocumentFile(file)
  const provider = resolveLlmProvider()
  if (!provider) throw new DocumentExtractionError(LLM_UNAVAILABLE_MESSAGE, 503, 'LLM_NOT_CONFIGURED')
  try {
    return await provider.extract(file)
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError(LLM_FAILED_MESSAGE, 503, 'LLM_EXTRACTION_FAILED')
  }
}
