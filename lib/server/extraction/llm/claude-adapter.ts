import 'server-only'

import { LLM_MODELS } from '../config'
import type { ExtractionResult } from '@/domain/exhibition/source-documents'
import type { LlmProvider } from './provider'
import {
  EXTRACTION_PROMPT,
  documentInputForLlm,
  fetchJsonWithTimeout,
  parseJsonPayload,
  toExtractionResult,
} from './shared'

export class ClaudeProvider implements LlmProvider {
  readonly id = 'CLAUDE' as const

  constructor(private readonly apiKey: string) {}

  async extract(file: File): Promise<ExtractionResult> {
    const input = await documentInputForLlm(file)
    const source =
      'pdfBase64' in input
        ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf', data: input.pdfBase64 } }
        : { type: 'text' as const, text: `Spreadsheet content:\n${input.text}` }
    const payload = await fetchJsonWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: LLM_MODELS.CLAUDE,
        max_tokens: 4096,
        messages: [{ role: 'user', content: [source, { type: 'text', text: EXTRACTION_PROMPT }] }],
      }),
    })
    const blocks = (payload as { content?: Array<{ type?: string; text?: string }> }).content ?? []
    const text = blocks.find((block) => block.type === 'text')?.text
    return toExtractionResult('LLM', parseJsonPayload(text ?? ''))
  }
}
