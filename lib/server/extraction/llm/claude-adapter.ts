import 'server-only'

import type { ExtractionResult } from '@/domain/exhibition/source-documents'
import type { LlmProvider } from './provider'
import { chatDocumentJson } from './document-json'
import { EXTRACTION_PROMPT, toExtractionResult } from './shared'

export class ClaudeProvider implements LlmProvider {
  readonly id = 'CLAUDE' as const

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  extract(file: File): Promise<ExtractionResult> {
    return chatDocumentJson('CLAUDE', { apiKey: this.apiKey, model: this.model }, EXTRACTION_PROMPT, file).then(
      (payload) => toExtractionResult('LLM', payload),
    )
  }
}
