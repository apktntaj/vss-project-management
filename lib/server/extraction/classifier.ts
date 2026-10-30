import 'server-only'

import { CONFIDENCE_THRESHOLD } from './config'
import type {
  DocumentClassification,
  DocumentClassificationType,
  IntendedKind,
} from '@/domain/exhibition/source-documents'
import type { ParsedDocument } from './deterministic/parsed-document'

const READABLE_TEXT_CHARS = 30

type Marker = { type: DocumentClassificationType; pattern: RegExp; weight: number }

const markers: Marker[] = [
  { type: 'CIPL_COMBINED', pattern: /(invoice\s*(and|&|\/)?\s*packing)|(packing\s*(and|&|\/)?\s*invoice)/i, weight: 0.6 },
  { type: 'PACKING_LIST', pattern: /packing\s*list/i, weight: 0.5 },
  { type: 'COMMERCIAL_INVOICE', pattern: /commercial\s+invoice/i, weight: 0.5 },
  { type: 'COMMERCIAL_INVOICE', pattern: /invoice\s*(no|number|#)/i, weight: 0.35 },
  { type: 'BILL_OF_LADING', pattern: /(bill\s*of\s*lading)|((master|house)\s*b\/l)|(b\/l\s*(no|number|#))/i, weight: 0.5 },
  { type: 'AIR_WAYBILL', pattern: /(air\s*waybill)|((m|h)awb)|(awb\s*(no|number|#))/i, weight: 0.5 },
  { type: 'AIR_WAYBILL', pattern: /(flight\s*(no|number)?)|(airport\s*of\s*(departure|destination))|airline/i, weight: 0.25 },
  { type: 'BILL_OF_LADING', pattern: /(port\s*of\s*(loading|discharge))|(vessel)|(voyage)/i, weight: 0.2 },
  { type: 'COMMERCIAL_INVOICE', pattern: /\binvoice\b/i, weight: 0.2 },
  { type: 'PACKING_LIST', pattern: /\b(net\s*weight|gross\s*weight|package)\b/i, weight: 0.1 },
]

const familyOf = (type: DocumentClassificationType): 'CIPL' | 'TRANSPORT' | null =>
  type === 'BILL_OF_LADING' || type === 'AIR_WAYBILL'
    ? 'TRANSPORT'
    : type === 'SUPPORTING_DOCUMENT' || type === 'UNREADABLE'
      ? null
      : 'CIPL'

/** Total: SELALU mengembalikan tepat satu nilai dari himpunan tertutup DocumentClassificationType. */
export function classifyDocument(parsed: ParsedDocument, intendedKind?: IntendedKind): DocumentClassification {
  if (intendedKind === 'SUPPORTING') {
    return {
      documentType: 'SUPPORTING_DOCUMENT',
      confidence: 1,
      needsUserConfirmation: false,
      rationale: null,
    }
  }

  const text = parsed.text.replace(/\s+/g, ' ')
  const readableChars = text.replace(/\s/g, '').length
  const scores = new Map<DocumentClassificationType, number>()
  for (const marker of markers) {
    if (!marker.pattern.test(text)) continue
    const intended = intendedKind && familyOf(marker.type) === intendedKind ? 0.05 : 0
    scores.set(marker.type, (scores.get(marker.type) ?? 0) + marker.weight + intended)
  }

  let best: { type: DocumentClassificationType; score: number } | null = null
  for (const [type, score] of scores) {
    if (!best || score > best.score) best = { type, score }
  }

  if (!best || best.score <= 0) {
    const readable = readableChars >= READABLE_TEXT_CHARS
    return {
      documentType: readable ? 'SUPPORTING_DOCUMENT' : 'UNREADABLE',
      confidence: readable ? 0.55 : 0.1,
      needsUserConfirmation: true,
      rationale: readable ? 'Tidak menemukan penanda jenis dokumen pabean yang dikenal.' : 'Teks yang dapat dibaca terlalu sedikit.',
    }
  }

  const strong = best.score >= 0.5
  const confidence = strong ? 0.9 : Math.max(0, Math.min(1, 0.3 + best.score))
  const matched = markers
    .map((marker) => (marker.type === best.type ? text.match(marker.pattern)?.[0]?.trim() : null))
    .filter((value): value is string => Boolean(value))
  return {
    documentType: best.type,
    confidence,
    needsUserConfirmation: confidence < CONFIDENCE_THRESHOLD,
    rationale: matched.length ? `Menemukan penanda: ${[...new Set(matched)].slice(0, 3).join(', ')}.` : null,
  }
}
