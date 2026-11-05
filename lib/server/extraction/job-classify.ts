import 'server-only'

import type { DocumentType } from '@/lib/server/document-extraction'
import type { ExtractionResult } from '@/domain/exhibition/source-documents'
import { runDeterministicExtraction } from './extraction-service'
import { DocumentExtractionError } from './errors'
import { assertSupportedDocumentFile } from './file-guard'
import { resolveLlmProvider } from './llm/provider'

/** Jenis klasifikasi baru dipetakan ke jenis lampiran job yang dikonsumsi UI job. */
const LEGACY_TYPES: Record<string, DocumentType> = {
  CIPL_COMBINED: 'CIPL',
  PACKING_LIST: 'PACKING_LIST',
  SUPPORTING_DOCUMENT: 'OTHER',
  COMMERCIAL_INVOICE: 'COMMERCIAL_INVOICE',
  BILL_OF_LADING: 'BILL_OF_LADING',
  AIR_WAYBILL: 'AIR_WAYBILL',
  UNREADABLE: 'UNREADABLE',
}

export function toLegacyDocumentKind(documentType: string): DocumentType {
  return LEGACY_TYPES[documentType] ?? 'OTHER'
}

/** Klasifikasi dokumen job: Claude (LLM_API_KEY) dicoba lebih dulu;
 *  gagal atau tak dikonfigurasi → lapisan deterministik (regex + OCR). */
export async function classifyJobDocument(file: File): Promise<ExtractionResult> {
  assertSupportedDocumentFile(file)
  const provider = resolveLlmProvider()
  if (provider) {
    try {
      return await provider.extract(file)
    } catch {
      // Timeout, PDF tanpa lapisan teks, layanan down — jatuh ke deterministik.
    }
  }
  try {
    return await runDeterministicExtraction(file)
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError('Dokumen tidak dapat diklasifikasikan. Coba lagi atau gunakan dokumen lain.', 502, 'CLASSIFICATION_FAILED')
  }
}
