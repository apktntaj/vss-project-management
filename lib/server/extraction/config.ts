import 'server-only'

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
export const EXTRACTION_TIMEOUT_MS = 30_000
/** LLM jauh lebih lambat dari parser lokal; dialog unggah terkunci skeleton selama menunggu. */
export const LLM_TIMEOUT_MS = 90_000
export const CONFIDENCE_THRESHOLD = 0.7
export const CONFIDENCE_BANDS = { LOW: 0.5, MEDIUM: 0.8 } as const

export type LlmProviderId = 'CLAUDE' | 'DEEPSEEK' | 'SUMOPOD'

export const LLM_MODELS: Record<LlmProviderId, string> = {
  CLAUDE: 'claude-3-5-haiku-latest',
  DEEPSEEK: 'deepseek-chat',
  SUMOPOD: 'gpt-4o-mini',
}

/** Membaca LLM_PROVIDER + LLM_API_KEY; tanpa LLM_PROVIDER default SUMOPOD.
 *  LLM_MODEL opsional menimpa model bawaan provider. */
export function configuredLlmProvider(): { id: LlmProviderId; apiKey: string; model: string } | null {
  const requested = process.env.LLM_PROVIDER?.trim().toUpperCase()
  const id = requested ? (requested in LLM_MODELS ? (requested as LlmProviderId) : null) : 'SUMOPOD'
  if (!id) return null
  const apiKey = process.env.LLM_API_KEY?.trim()
  if (!apiKey) return null
  return { id, apiKey, model: process.env.LLM_MODEL?.trim() || LLM_MODELS[id] }
}
