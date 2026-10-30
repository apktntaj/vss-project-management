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

export class GeminiProvider implements LlmProvider {
  readonly id = 'GEMINI' as const

  constructor(private readonly apiKey: string) {}

  async extract(file: File): Promise<ExtractionResult> {
    const input = await documentInputForLlm(file)
    const part =
      'pdfBase64' in input
        ? { inlineData: { mimeType: 'application/pdf', data: input.pdfBase64 } }
        : { text: `Spreadsheet content:\n${input.text}` }
    const payload = await fetchJsonWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODELS.GEMINI}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: EXTRACTION_PROMPT }, part] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      },
    )
    const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates ?? []
    const text = candidates[0]?.content?.parts?.find((part) => part.text)?.text
    return toExtractionResult('LLM', parseJsonPayload(text ?? ''))
  }
}
