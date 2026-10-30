import 'server-only'

import { DocumentExtractionError, LLM_FAILED_MESSAGE } from '../errors'
import { isPdf } from '../file-guard'
import { parsePdfTextLayer } from '../deterministic/pdf-text-parser'
import { extractPageImages } from '../deterministic/pdf-images'
import { pnmToPng } from '../deterministic/pnm-to-png'
import { documentInputForLlm, fetchJsonWithTimeout, parseJsonPayload } from './shared'
import type { LlmProviderId } from '../config'

export type DocumentChatConfig = { apiKey: string; model: string }

const MAX_VISION_PAGES = 5
const VISION_MAX_EDGE = 1600

type VisionPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

/** Dokumen menjadi payload chat: teks (PDF berlapis teks / spreadsheet) atau gambar halaman (hasil pindai). */
async function documentParts(
  file: File,
  supportsVision: boolean,
): Promise<{ kind: 'text'; text: string } | { kind: 'images'; urls: string[] }> {
  if (isPdf(file)) {
    const parsed = await parsePdfTextLayer(file)
    if (parsed.hasTextLayer) return { kind: 'text', text: parsed.text }
    if (!supportsVision) throw new DocumentExtractionError(LLM_FAILED_MESSAGE, 503, 'LLM_EXTRACTION_FAILED')
    const pages = await extractPageImages(file, MAX_VISION_PAGES)
    if (!pages.length) throw new DocumentExtractionError(LLM_FAILED_MESSAGE, 503, 'LLM_EXTRACTION_FAILED')
    return {
      kind: 'images',
      urls: pages.map((page) => `data:image/png;base64,${pnmToPng(page.ppm, VISION_MAX_EDGE).toString('base64')}`),
    }
  }
  const input = await documentInputForLlm(file)
  return { kind: 'text', text: 'text' in input ? input.text : '' }
}

async function openaiJson(
  baseUrl: string,
  config: DocumentChatConfig,
  prompt: string,
  file: File,
  supportsVision: boolean,
  system?: string,
): Promise<Record<string, unknown>> {
  const payload = await documentParts(file, supportsVision)
  const content: string | VisionPart[] =
    payload.kind === 'text'
      ? `${prompt}\n\nDocument content:\n${payload.text}`
      : [
          { type: 'text', text: `${prompt}\n\nThe document is a scanned PDF; each page image is attached in order.` },
          ...payload.urls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
        ]
  const messages: Array<{ role: 'system' | 'user'; content: string | VisionPart[] }> = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content })
  const response = await fetchJsonWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages,
    }),
  })
  const choices = (response as { choices?: Array<{ message?: { content?: string } }> }).choices ?? []
  return parseJsonPayload(choices[0]?.message?.content ?? '')
}

async function claudeJson(
  config: DocumentChatConfig,
  prompt: string,
  file: File,
  system?: string,
): Promise<Record<string, unknown>> {
  const input = await documentInputForLlm(file)
  const source =
    'pdfBase64' in input
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf', data: input.pdfBase64 } }
      : { type: 'text' as const, text: `Spreadsheet content:\n${input.text}` }
  const payload = await fetchJsonWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: [source, { type: 'text', text: prompt }] }],
    }),
  })
  const blocks = (payload as { content?: Array<{ type?: string; text?: string }> }).content ?? []
  return parseJsonPayload(blocks.find((block) => block.type === 'text')?.text ?? '')
}

const OPENAI_BASE_URL: Record<string, string> = {
  DEEPSEEK: 'https://api.deepseek.com',
  SUMOPOD: 'https://ai.sumopod.com/v1',
}

/** Satu pintu "kirim dokumen + prompt, terima JSON" untuk semua provider.
 *  `system` opsional: instruksi tetap dikirim sebagai system prompt provider
 *  (pesan system OpenAI-compatible / parameter system Anthropic). */
export async function chatDocumentJson(
  id: LlmProviderId,
  config: DocumentChatConfig,
  prompt: string,
  file: File,
  system?: string,
): Promise<Record<string, unknown>> {
  if (id === 'CLAUDE') return claudeJson(config, prompt, file, system)
  // deepseek-chat tidak multimodal; SumoPod (gpt-4o-mini) membaca halaman pindai sebagai gambar.
  const supportsVision = id !== 'DEEPSEEK'
  const baseUrl = id === 'SUMOPOD' ? process.env.LLM_BASE_URL?.trim() || OPENAI_BASE_URL.SUMOPOD : OPENAI_BASE_URL[id]
  return openaiJson(baseUrl, config, prompt, file, supportsVision, system)
}
