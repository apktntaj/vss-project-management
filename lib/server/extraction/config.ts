import 'server-only'

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
export const EXTRACTION_TIMEOUT_MS = 30_000
export const CONFIDENCE_THRESHOLD = 0.7
export const CONFIDENCE_BANDS = { LOW: 0.5, MEDIUM: 0.8 } as const

export type LlmProviderId = 'GEMINI' | 'CLAUDE' | 'DEEPSEEK'

export const LLM_MODELS: Record<LlmProviderId, string> = {
  GEMINI: 'gemini-3.5-flash-lite',
  CLAUDE: 'claude-3-5-haiku-latest',
  DEEPSEEK: 'deepseek-chat',
}

/** Membaca LLM_PROVIDER + LLM_API_KEY; GEMINI_API_KEY lama tetap sah untuk provider GEMINI. */
export function configuredLlmProvider(): { id: LlmProviderId; apiKey: string } | null {
  const requested = process.env.LLM_PROVIDER?.trim().toUpperCase()
  const id = requested ? (requested in LLM_MODELS ? (requested as LlmProviderId) : null) : 'GEMINI'
  if (!id) return null
  const apiKey =
    process.env.LLM_API_KEY?.trim() || (id === 'GEMINI' ? process.env.GEMINI_API_KEY?.trim() : '')
  return apiKey ? { id, apiKey } : null
}
