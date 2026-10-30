import 'server-only'

import type {
  DocumentClassification,
  DocumentExtraction,
  DocumentType,
} from '@/lib/server/document-extraction'
import type { ExtractionResult } from '@/domain/exhibition/source-documents'
import { runDeterministicExtraction } from './extraction-service'
import { DocumentExtractionError } from './errors'
import { assertSupportedDocumentFile } from './file-guard'
import { resolveLlmProvider } from './llm/provider'

/** Jenis klasifikasi baru dipetakan ke 5 jenis legacy yang dikonsumsi UI job. */
const LEGACY_TYPES: Record<string, DocumentType> = {
  CIPL_COMBINED: 'COMMERCIAL_INVOICE',
  PACKING_LIST: 'OTHER',
  SUPPORTING_DOCUMENT: 'OTHER',
  COMMERCIAL_INVOICE: 'COMMERCIAL_INVOICE',
  BILL_OF_LADING: 'BILL_OF_LADING',
  AIR_WAYBILL: 'AIR_WAYBILL',
  UNREADABLE: 'UNREADABLE',
}

function toLegacyExtraction(result: ExtractionResult): DocumentExtraction {
  const classification: DocumentClassification = {
    documentType: LEGACY_TYPES[result.classification.documentType] ?? 'OTHER',
    confidence: result.classification.confidence,
    rationale: result.classification.rationale,
  }
  return { classification, invoice: result.invoice, transport: result.transport }
}

/** Klasifikasi dokumen job: provider LLM terkonfigurasi (LLM_PROVIDER) dicoba lebih dulu;
 *  gagal atau tak dikonfigurasi → lapisan deterministik (regex + OCR). */
export async function classifyJobDocument(file: File): Promise<DocumentExtraction> {
  assertSupportedDocumentFile(file)
  const provider = resolveLlmProvider()
  if (provider) {
    try {
      return toLegacyExtraction(await provider.extract(file))
    } catch {
      // Timeout, PDF tanpa lapisan teks, layanan down — jatuh ke deterministik.
    }
  }
  try {
    return toLegacyExtraction(await runDeterministicExtraction(file))
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError('Dokumen tidak dapat diklasifikasikan. Coba lagi atau gunakan dokumen lain.', 502, 'CLASSIFICATION_FAILED')
  }
}
