import 'server-only'

import { LLM_MODELS } from '../config'
import { DocumentExtractionError } from '../errors'
import { isPdf } from '../file-guard'
import { parsePdfTextLayer } from '../deterministic/pdf-text-parser'
import type { ExtractionResult } from '@/domain/exhibition/source-documents'
import type { LlmProvider } from './provider'
import {
  LLM_FAILED_MESSAGE,
  EXTRACTION_PROMPT,
  documentInputForLlm,
  fetchJsonWithTimeout,
  parseJsonPayload,
  toExtractionResult,
} from './shared'

export class DeepseekProvider implements LlmProvider {
  readonly id = 'DEEPSEEK' as const

  constructor(private readonly apiKey: string) {}

  async extract(file: File): Promise<ExtractionResult> {
    // DeepSeek chat menerima teks saja: PDF harus punya lapisan teks.
    let content: string
    if (isPdf(file)) {
      const parsed = await parsePdfTextLayer(file)
      if (!parsed.hasTextLayer) throw new DocumentExtractionError(LLM_FAILED_MESSAGE, 503, 'LLM_EXTRACTION_FAILED')
      content = parsed.text
    } else {
      const input = await documentInputForLlm(file)
      content = 'text' in input ? input.text : ''
    }
    const payload = await fetchJsonWithTimeout(`${'https://api.deepseek.com'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: LLM_MODELS.DEEPSEEK,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}\n\nDocument content:\n${content}` }],
      }),
    })
    const choices = (payload as { choices?: Array<{ message?: { content?: string } }> }).choices ?? []
    const text = choices[0]?.message?.content
    return toExtractionResult('LLM', parseJsonPayload(text ?? ''))
  }
}
