import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { DocumentExtractionError, LLM_FAILED_MESSAGE } from '../errors'
import { LLM_TIMEOUT_MS } from '../config'
import { documentInputForLlm, parseJsonPayload } from './shared'

export type DocumentChatConfig = { apiKey: string; model: string }

/** Output besar: JSON CIPL/manifest konsolidasi bisa >8k token; 32k mencegah truncation (stop_reason=max_tokens). */
const CLAUDE_MAX_TOKENS = 32000

/** Satu pintu "kirim dokumen + prompt, terima JSON" via Claude (@anthropic-ai/sdk).
 *  `system` opsional dikirim sebagai parameter system Anthropic. */
export async function chatDocumentJson(
  config: DocumentChatConfig,
  prompt: string,
  file: File,
  system?: string,
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  const input = await documentInputForLlm(file)
  const source: Anthropic.ContentBlockParam =
    'pdfBase64' in input
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.pdfBase64 } }
      : { type: 'text', text: `Spreadsheet content:\n${input.text}` }
  const client = new Anthropic({ apiKey: config.apiKey })
  try {
    const message = await client.messages.create(
      {
        model: config.model,
        max_tokens: CLAUDE_MAX_TOKENS,
        // Tanpa ini model menghabiskan seluruh max_tokens untuk thinking → blok teks kosong, JSON tak terbit.
        thinking: { type: 'between_tools' },
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: [source, { type: 'text', text: prompt }] }],
      },
      { timeout: timeoutMs ?? LLM_TIMEOUT_MS },
    )
    const textBlock = message.content.find((block) => block.type === 'text')
    return parseJsonPayload(textBlock && 'text' in textBlock ? textBlock.text : '')
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    const timedOut = error instanceof Anthropic.APIConnectionTimeoutError
    throw new DocumentExtractionError(
      LLM_FAILED_MESSAGE,
      503,
      timedOut ? 'LLM_EXTRACTION_TIMEOUT' : 'LLM_EXTRACTION_FAILED',
    )
  }
}
