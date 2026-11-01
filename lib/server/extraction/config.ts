import 'server-only'

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
export const EXTRACTION_TIMEOUT_MS = 30_000
/** LLM jauh lebih lambat dari parser lokal; dialog unggah terkunci skeleton selama menunggu. */
export const LLM_TIMEOUT_MS = 90_000
export const CONFIDENCE_THRESHOLD = 0.7
export const CONFIDENCE_BANDS = { LOW: 0.5, MEDIUM: 0.8 } as const

/** Haiku default demi biaya; dokumen sulit (tabel konsolidasi) bisa pakai CIPL_SCAN_MODEL/LLM_MODEL=claude-sonnet-5-5. */
export const DEFAULT_LLM_MODEL = 'claude-haiku-5-5'

/** Membaca LLM_API_KEY (Anthropic). LLM_MODEL opsional menimpa model default. */
export function configuredLlmProvider(): { apiKey: string; model: string } | null {
  const apiKey = process.env.LLM_API_KEY?.trim()
  if (!apiKey) return null
  return { apiKey, model: process.env.LLM_MODEL?.trim() || DEFAULT_LLM_MODEL }
}

/** Pintu scan CIPL: CIPL_SCAN_MODEL menimpa model global; tabel konsolidasi butuh model lebih kuat. */
export function configuredScanCiplProvider(): { apiKey: string; model: string } | null {
  const apiKey = process.env.LLM_API_KEY?.trim()
  if (!apiKey) return null
  return { apiKey, model: process.env.CIPL_SCAN_MODEL?.trim() || process.env.LLM_MODEL?.trim() || DEFAULT_LLM_MODEL }
}
