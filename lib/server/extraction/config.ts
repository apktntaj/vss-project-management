import 'server-only'

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
export const EXTRACTION_TIMEOUT_MS = 30_000
/** LLM jauh lebih lambat dari parser lokal; dialog unggah terkunci skeleton selama menunggu. */
export const LLM_TIMEOUT_MS = 90_000
/** Sisi terpanjang halaman untuk OCR cadangan (±212 dpi A4); 3× lebih cepat dari 3508 px dengan teks tetap terbaca. */
export const OCR_PAGE_MAX_EDGE = 2480
/** 1568 px = ambang resize Anthropic; lebih besar hanya memperbesar upload tanpa menambah detail. */
export const LLM_PAGE_MAX_EDGE = 1568
export const LLM_MAX_IMAGE_PAGES = 20
/** Anthropic membatasi 5 MB per gambar. */
export const LLM_MAX_IMAGE_BYTES = 4.5 * 1024 * 1024
export const CONFIDENCE_THRESHOLD = 0.7
export const CONFIDENCE_BANDS = { LOW: 0.5, MEDIUM: 0.8 } as const

/** Haiku default demi biaya & tanpa thinking. */
export const DEFAULT_LLM_MODEL = 'claude-haiku-5-5'
/** Dicoba satu kali bila model utama gagal (bukan timeout); lebih mahal dan butuh `between_tools` untuk mematikan thinking. */
export const FALLBACK_LLM_MODEL = 'claude-sonnet-5-5'

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

/** Pencocokan pos BTKI (tool HS BTKI): klasifikasi butuh penalaran, jadi default Sonnet; BTKI_MATCH_MODEL / LLM_MODEL menimpa. */
export function configuredBtkiMatchProvider(): { apiKey: string; model: string } | null {
  const apiKey = process.env.LLM_API_KEY?.trim()
  if (!apiKey) return null
  return { apiKey, model: process.env.BTKI_MATCH_MODEL?.trim() || process.env.LLM_MODEL?.trim() || FALLBACK_LLM_MODEL }
}
