import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { DocumentExtractionError, LLM_FAILED_MESSAGE } from '../errors'
import { LLM_TIMEOUT_MS } from '../config'
import { documentInputForLlm, parseJsonPayload } from './shared'

export type DocumentChatConfig = { apiKey: string; model: string }

/** Output besar: JSON CIPL/manifest konsolidasi bisa >8k token; 32k mencegah truncation (stop_reason=max_tokens). */
const CLAUDE_MAX_TOKENS = 32000

/**
 * Mematikan thinking agar tak memakan output token (thinking ditagih sebagai output). Switch-nya beda per model:
 * Sonnet/Opus menerima `between_tools`, Haiku menerima `disabled`. Dicoba berurutan; `undefined` = biarkan default
 * (thinking adaptif, mahal) sebagai upaya terakhir bila keduanya ditolak.
 */
const THINKING_OFF: ReadonlyArray<Anthropic.ThinkingConfigParam | undefined> = [
  { type: 'between_tools' },
  { type: 'disabled' },
  undefined,
]

/** Index THINKING_OFF yang diterima tiap model, dipelajari saat runtime agar panggilan berikutnya tak 400 berulang. */
const acceptedThinkingMode = new Map<string, number>()

function createParams(
  config: DocumentChatConfig,
  content: Anthropic.ContentBlockParam[],
  thinking: Anthropic.ThinkingConfigParam | undefined,
  system?: string,
): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: config.model,
    max_tokens: CLAUDE_MAX_TOKENS,
    ...(thinking ? { thinking } : {}),
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content }],
  }
}

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
  const content: Anthropic.ContentBlockParam[] = [source, { type: 'text', text: prompt }]
  const client = new Anthropic({ apiKey: config.apiKey })
  const options = { timeout: timeoutMs ?? LLM_TIMEOUT_MS }
  try {
    let index = acceptedThinkingMode.get(config.model) ?? 0
    let message: Anthropic.Message | null = null
    while (message === null) {
      try {
        message = await client.messages.create(createParams(config, content, THINKING_OFF[index], system), options)
        acceptedThinkingMode.set(config.model, index)
      } catch (error) {
        const rejectedThinking =
          error instanceof Anthropic.BadRequestError && /thinking\.type/.test(error.message)
        if (!rejectedThinking || index >= THINKING_OFF.length - 1) throw error
        index += 1
      }
    }
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
