import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { DocumentExtractionError, LLM_FAILED_MESSAGE } from '../errors'
import { FALLBACK_LLM_MODEL, LLM_TIMEOUT_MS } from '../config'
import { documentInputForLlm, parseJsonPayload } from './shared'

export type DocumentChatConfig = { apiKey: string; model: string }

/** Output besar: JSON CIPL/manifest konsolidasi bisa >8k token; 32k mencegah truncation (stop_reason=max_tokens). */
const CLAUDE_MAX_TOKENS = 32000

/**
 * Mematikan thinking agar tak memakan output token (thinking ditagih sebagai output).
 * Switch-nya beda per model; `thinkingModes` mengurutkan percobaan.
 */
const THINKING_DISABLED: Anthropic.ThinkingConfigParam = { type: 'disabled' }
const THINKING_BETWEEN_TOOLS: Anthropic.ThinkingConfigParam = { type: 'between_tools' }

/** Haiku menolak `between_tools` dengan 400 (terukur: claude-haiku-5-5) dan menerima `disabled`; Sonnet/Opus kebalikannya. `undefined` = default model sebagai upaya terakhir. */
function thinkingModes(model: string): ReadonlyArray<Anthropic.ThinkingConfigParam | undefined> {
  return /haiku/i.test(model)
    ? [THINKING_DISABLED, THINKING_BETWEEN_TOOLS, undefined]
    : [THINKING_BETWEEN_TOOLS, THINKING_DISABLED, undefined]
}

/** Index urutan thinkingModes yang diterima tiap model, dipelajari saat runtime agar panggilan berikutnya tak 400 berulang. */
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
  const sources: Anthropic.ContentBlockParam[] =
    'pdfBase64' in input
      ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.pdfBase64 } }]
      : 'pagePngsBase64' in input
        ? input.pagePngsBase64.map((data) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data } }))
        : [{ type: 'text', text: `Spreadsheet content:\n${input.text}` }]
  const content: Anthropic.ContentBlockParam[] = [...sources, { type: 'text', text: prompt }]
  const client = new Anthropic({ apiKey: config.apiKey })
  const options = { timeout: timeoutMs ?? LLM_TIMEOUT_MS }
  const inputKind = 'pdfBase64' in input ? 'pdf' : 'pagePngsBase64' in input ? 'page-images' : 'spreadsheet'
  const models = config.model === FALLBACK_LLM_MODEL ? [config.model] : [config.model, FALLBACK_LLM_MODEL]
  for (const [attempt, model] of models.entries()) {
    try {
      return await requestJson(client, { ...config, model }, content, system, options)
    } catch (error) {
      const timedOut = error instanceof Anthropic.APIConnectionTimeoutError
      console.error('LLM document extraction failed', {
        model,
        input: inputKind,
        status: error instanceof Anthropic.APIError ? error.status : undefined,
        timedOut,
        message: error instanceof Error ? error.message : 'unknown',
      })
      // Timeout tidak dicoba ulang: dialog unggah terkunci selama menunggu, jadi percobaan kedua menggandakan waktu tunggu.
      if (!timedOut && attempt < models.length - 1) continue
      if (error instanceof DocumentExtractionError) throw error
      throw new DocumentExtractionError(
        LLM_FAILED_MESSAGE,
        503,
        timedOut ? 'LLM_EXTRACTION_TIMEOUT' : 'LLM_EXTRACTION_FAILED',
      )
    }
  }
  throw new DocumentExtractionError(LLM_FAILED_MESSAGE, 503, 'LLM_EXTRACTION_FAILED')
}

/** "Kirim teks + prompt, terima JSON" tanpa dokumen; tanpa model cadangan — pemanggil yang menentukan cadangannya. */
export async function chatTextJson(
  config: DocumentChatConfig,
  prompt: string,
  system?: string,
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: config.apiKey })
  return requestJson(client, config, [{ type: 'text', text: prompt }], system, { timeout: timeoutMs ?? LLM_TIMEOUT_MS })
}

async function requestJson(
  client: Anthropic,
  config: DocumentChatConfig,
  content: Anthropic.ContentBlockParam[],
  system: string | undefined,
  options: { timeout: number },
): Promise<Record<string, unknown>> {
  const modes = thinkingModes(config.model)
  let index = acceptedThinkingMode.get(config.model) ?? 0
  let message: Anthropic.Message | null = null
  while (message === null) {
    try {
      message = await client.messages.create(createParams(config, content, modes[index], system), options)
      acceptedThinkingMode.set(config.model, index)
    } catch (error) {
      const rejectedThinking = error instanceof Anthropic.BadRequestError && /thinking\.type/.test(error.message)
      if (!rejectedThinking || index >= modes.length - 1) throw error
      index += 1
    }
  }
  const textBlock = message.content.find((block) => block.type === 'text')
  return parseJsonPayload(textBlock && 'text' in textBlock ? textBlock.text : '')
}
