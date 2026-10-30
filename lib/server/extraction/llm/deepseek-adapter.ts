import 'server-only'

import type { ExtractionResult } from '@/domain/exhibition/source-documents'
import type { LlmProvider } from './provider'
import { chatDocumentJson } from './document-json'
import { EXTRACTION_PROMPT, EXTRACTION_USER_PROMPT, toExtractionResult } from './shared'

export class DeepseekProvider implements LlmProvider {
  readonly id = 'DEEPSEEK' as const

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  extract(file: File): Promise<ExtractionResult> {
    return chatDocumentJson('DEEPSEEK', { apiKey: this.apiKey, model: this.model }, EXTRACTION_USER_PROMPT, file, EXTRACTION_PROMPT).then(
      (payload) => toExtractionResult('LLM', payload),
    )
  }
}
