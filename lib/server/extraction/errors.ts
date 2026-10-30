import 'server-only'

export type ExtractionErrorCode =
  | 'UNREADABLE_DOCUMENT'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_REQUIRED'
  | 'OWNER_NOT_FOUND'
  | 'OCR_FAILED'
  | 'LLM_EXTRACTION_TIMEOUT'
  | 'LLM_EXTRACTION_FAILED'
  | 'LLM_NOT_CONFIGURED'
  | 'LLM_EXTRACTION_UNAVAILABLE'
  | 'EXTRACTION_SERVICE_UNAVAILABLE'
  | 'ATTACHMENT_STORE_UNAVAILABLE'
  | 'CIPL_MERGE_UNMATCHED'
  | 'CIPL_COMBINATION_INVALID'
  | 'MANDATORY_DOCUMENTS_INCOMPLETE'
  | 'CLASSIFICATION_FAILED'

export class DocumentExtractionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 502 | 503,
    readonly code: ExtractionErrorCode,
    readonly context: Record<string, string> = {},
  ) {
    super(message)
  }
}

export const LLM_UNAVAILABLE_MESSAGE = 'Ekstraksi LLM tidak tersedia karena belum ada penyedia LLM yang dikonfigurasi.'
export const LLM_FAILED_MESSAGE = 'Ekstraksi LLM gagal. Coba lagi atau gunakan hasil deterministik.'
export const MANDATORY_INCOMPLETE_MESSAGE = 'Dokumen wajib shipment belum lengkap: CIPL dan B/L atau AWB.'
