import 'server-only'

import {
  buildBtkiCandidates,
  hsPrefix,
  lexicalMatch,
  type BtkiCandidate,
  type BtkiConfidence,
  type BtkiMatch,
  type BtkiMatchInput,
  type BtkiMatchResponse,
} from '@/lib/btki-match'
import { inswLookupConfig } from '@/lib/insw-config'
import { searchBtkiPrefixes } from '@/lib/insw-lartas'
import { configuredBtkiMatchProvider } from './extraction/config'
import { chatTextJson } from './extraction/llm/document-json'

// Saran pos BTKI 8 digit: kandidat diambil dari INSW per awalan HS, lalu uraian barang dicocokkan
// oleh Claude. Tanpa LLM (atau bila gagal) dipakai pencocokan kata, yang selalu ditandai lemah.

const MATCH_SYSTEM_PROMPT =
  'You assist an Indonesian customs broker (PPJK). Each invoice item already has an HS subheading; choose the single best Indonesian BTKI 8-digit tariff line for it among the candidate lines of its group. ' +
  'Each candidate is written as "code | parent description > ... > line description". Read the whole path: a line only applies when every level of its path fits the item. ' +
  'Prefer the most specific line that actually describes the item. Choose a residual "Other" line only when no specific line at that level fits. Item descriptions may be in English, Indonesian, Chinese, or abbreviated trade names. ' +
  'Never invent a code: "code" must be one of the candidate codes of the item\'s group. ' +
  'Return only JSON: {"matches":[{"id":"<item id>","code":"<8 digits>","confidence":<0-1>,"reason":"<Indonesian, at most 15 words>"}]} with one entry per item. ' +
  'Use confidence below 0.5 when the description is too vague to decide between lines (for example a material, capacity, or use that the invoice does not state), and say in reason what information is missing.'

type Pending = { key: string; group: string; description: string; ids: string[] }

function candidateLine(candidate: BtkiCandidate): string {
  const path = candidate.pathEn.length > 0 ? candidate.pathEn : candidate.pathId
  return `${candidate.code} | ${path.join(' > ')}`
}

function confidenceFrom(value: unknown): BtkiConfidence {
  const score = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return score >= 0.8 ? 'tinggi' : score >= 0.5 ? 'sedang' : 'rendah'
}

async function askLlm(
  pending: readonly Pending[],
  groups: Record<string, BtkiCandidate[]>,
): Promise<Map<string, { code: string; confidence: BtkiConfidence; reason: string | null }>> {
  const provider = configuredBtkiMatchProvider()
  const answers = new Map<string, { code: string; confidence: BtkiConfidence; reason: string | null }>()
  if (!provider) return answers

  const groupKeys = [...new Set(pending.map((entry) => entry.group))]
  const prompt = [
    'GROUPS',
    ...groupKeys.map((key) => `[${key}]\n${groups[key].map(candidateLine).join('\n')}`),
    '',
    'ITEMS',
    ...pending.map((entry) => JSON.stringify({ id: entry.key, group: entry.group, description: entry.description })),
  ].join('\n')

  const payload = await chatTextJson(provider, prompt, MATCH_SYSTEM_PROMPT)
  const matches = Array.isArray(payload.matches) ? payload.matches : []
  const byKey = new Map(pending.map((entry) => [entry.key, entry]))
  for (const match of matches) {
    if (!match || typeof match !== 'object') continue
    const record = match as Record<string, unknown>
    const entry = byKey.get(String(record.id ?? ''))
    const code = String(record.code ?? '').replace(/\D/g, '')
    // Kode di luar kandidat = halusinasi; baris itu jatuh ke pencocokan kata.
    if (!entry || !groups[entry.group].some((candidate) => candidate.code === code)) continue
    answers.set(entry.key, {
      code,
      confidence: confidenceFrom(record.confidence),
      reason: typeof record.reason === 'string' && record.reason.trim() ? record.reason.trim().slice(0, 200) : null,
    })
  }
  return answers
}

export async function suggestBtki(items: readonly BtkiMatchInput[]): Promise<BtkiMatchResponse> {
  const prefixes = new Map(items.map((item) => [item.id, hsPrefix(item.hsCode).prefix]))
  const config = inswLookupConfig()
  const wanted = [...new Set([...prefixes.values()].filter((prefix): prefix is string => prefix !== null))]

  const groups: Record<string, BtkiCandidate[]> = {}
  const groupOf = new Map<string, string>()
  const sourceErrors = new Map<string, string>()

  const first = await searchBtkiPrefixes(wanted, config)
  const widen: string[] = []
  for (const prefix of wanted) {
    const result = first[prefix]
    if (result?.error) {
      sourceErrors.set(prefix, result.error)
      continue
    }
    const candidates = buildBtkiCandidates(result?.rows ?? [], prefix)
    if (candidates.length > 0) {
      groups[prefix] = candidates
      groupOf.set(prefix, prefix)
    } else if (prefix.length === 6) {
      // Subpos tak ada di BTKI (beda versi HS atau salah ketik): tawarkan seluruh pos 4 digitnya.
      widen.push(prefix)
    }
  }
  if (widen.length > 0) {
    const second = await searchBtkiPrefixes(widen.map((prefix) => prefix.slice(0, 4)), config)
    for (const prefix of widen) {
      const heading = prefix.slice(0, 4)
      const result = second[heading]
      if (result?.error) {
        sourceErrors.set(prefix, result.error)
        continue
      }
      if (!groups[heading]) {
        const candidates = buildBtkiCandidates(result?.rows ?? [], heading)
        if (candidates.length === 0) continue
        groups[heading] = candidates
      }
      groupOf.set(prefix, heading)
    }
  }

  const matches = new Map<string, BtkiMatch>()
  const pending = new Map<string, Pending>()
  for (const item of items) {
    const prefix = prefixes.get(item.id) ?? null
    const group = prefix ? (groupOf.get(prefix) ?? null) : null
    const base = { id: item.id, prefix, group }
    if (!prefix) {
      matches.set(item.id, { ...base, suggested: null, method: 'tidak-ada', confidence: 'rendah', reason: 'HS code di invoice kurang dari 4 digit.' })
      continue
    }
    if (!group) {
      matches.set(item.id, {
        ...base,
        suggested: null,
        method: 'tidak-ada',
        confidence: 'rendah',
        reason: sourceErrors.get(prefix) ?? `Awalan ${prefix} tidak ditemukan di BTKI INSW.`,
      })
      continue
    }
    const candidates = groups[group]
    if (candidates.length === 1 && group === prefix) {
      matches.set(item.id, { ...base, suggested: candidates[0].code, method: 'tunggal', confidence: 'tinggi', reason: 'Satu-satunya pos 8 digit pada subpos ini.' })
      continue
    }
    const description = item.description.trim()
    if (!description) {
      matches.set(item.id, { ...base, suggested: null, method: 'tidak-ada', confidence: 'rendah', reason: 'Uraian barang kosong; pilih pos secara manual.' })
      continue
    }
    const key = `${group}|${description.toLowerCase()}`
    const entry = pending.get(key)
    if (entry) entry.ids.push(item.id)
    else pending.set(key, { key: String(pending.size + 1), group, description: description.slice(0, 400), ids: [item.id] })
  }

  let notice: string | null = null
  const queue = [...pending.values()]
  let answers = new Map<string, { code: string; confidence: BtkiConfidence; reason: string | null }>()
  if (queue.length > 0) {
    if (!configuredBtkiMatchProvider()) {
      notice = 'Pencocokan AI belum dikonfigurasi (LLM_API_KEY); saran memakai kecocokan kata dan perlu diperiksa satu per satu.'
    } else {
      try {
        answers = await askLlm(queue, groups)
      } catch (error) {
        console.error('BTKI match LLM failed', { message: error instanceof Error ? error.message : 'unknown' })
        notice = 'Pencocokan AI gagal; saran memakai kecocokan kata dan perlu diperiksa satu per satu.'
      }
    }
  }

  for (const entry of queue) {
    const answer = answers.get(entry.key)
    const widened = (prefix: string | null) => prefix !== null && prefix !== entry.group
    for (const id of entry.ids) {
      const prefix = prefixes.get(id) ?? null
      const base = { id, prefix, group: entry.group }
      const note = widened(prefix) ? ` Subpos ${prefix} tidak ada di BTKI; dicari pada pos ${entry.group}.` : ''
      if (answer) {
        matches.set(id, {
          ...base,
          suggested: answer.code,
          method: 'ai',
          // Subpos invoice yang tak dikenal BTKI tak pernah layak "tinggi".
          confidence: widened(prefix) && answer.confidence === 'tinggi' ? 'sedang' : answer.confidence,
          reason: `${answer.reason ?? ''}${note}`.trim() || null,
        })
        continue
      }
      const lexical = lexicalMatch(entry.description, groups[entry.group])
      matches.set(id, {
        ...base,
        suggested: lexical.code,
        method: lexical.code ? 'kata' : 'tidak-ada',
        confidence: widened(prefix) ? 'rendah' : lexical.confidence,
        reason: `${lexical.reason}${note}`,
      })
    }
  }

  const usedGroups = new Set([...matches.values()].map((match) => match.group).filter(Boolean))
  return {
    groups: Object.fromEntries(Object.entries(groups).filter(([key]) => usedGroups.has(key))),
    matches: items.map((item) => matches.get(item.id)!),
    notice,
  }
}
