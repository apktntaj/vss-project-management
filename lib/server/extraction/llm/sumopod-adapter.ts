import 'server-only'

import type { ExtractionResult } from '@/domain/exhibition/source-documents'
import type { LlmProvider } from './provider'
import { chatDocumentJson } from './document-json'
import { EXTRACTION_PROMPT, toExtractionResult } from './shared'

/** SumoPod: gateway OpenAI-compatible; LLM_BASE_URL menimpa base URL bila memakai gateway lain. */
export class SumopodProvider implements LlmProvider {
  readonly id = 'SUMOPOD' as const

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  extract(file: File): Promise<ExtractionResult> {
    return chatDocumentJson('SUMOPOD', { apiKey: this.apiKey, model: this.model }, EXTRACTION_PROMPT, file).then(
      (payload) => toExtractionResult('LLM', payload),
    )
  }
}
