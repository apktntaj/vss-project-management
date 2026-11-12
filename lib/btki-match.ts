// Pencocokan pos BTKI 8 digit untuk tool "HS BTKI". Murni (tanpa I/O maupun React): memotong HS
// invoice ke 6 digit, menyusun kandidat pos 8 digit dari baris BTKI INSW, dan mencocokkan uraian
// barang secara leksikal sebagai cadangan bila pencocokan AI tidak tersedia.

/** Satu baris BTKI apa adanya dari INSW, terurut seperti di buku tarif. */
export type BtkiRow = {
  /** Urutan baris di BTKI (id_btbmi INSW). */
  id: number
  /** Digit kode tanpa pemisah: 4 (pos), 6 (subpos), atau 8 (pos tarif). */
  code: string
  /** false untuk baris judul kelompok yang tidak bisa dipakai di PIB. */
  declarable: boolean
  uraianId: string
  uraianEn: string
}

export type BtkiCandidate = {
  /** Pos tarif 8 digit tanpa pemisah. */
  code: string
  formatted: string
  uraianId: string
  uraianEn: string
  /** Uraian dari tingkat teratas sampai pos ini (termasuk pos ini). */
  pathId: string[]
  pathEn: string[]
}

export type HsPrefix = {
  /** Awalan yang dicari di BTKI; null bila HS invoice tak cukup digit. */
  prefix: string | null
  /** true bila HS invoice lebih dari 6 digit sehingga dipotong. */
  truncated: boolean
}

export type BtkiMatchMethod = 'tunggal' | 'ai' | 'kata' | 'tidak-ada'
export type BtkiConfidence = 'tinggi' | 'sedang' | 'rendah'

export type BtkiMatchInput = { id: string; description: string; hsCode: string }

export type BtkiMatch = {
  id: string
  /** Awalan HS invoice (6 digit, atau 4 digit bila invoice hanya menulis pos). */
  prefix: string | null
  /** Kunci ke `groups`; berbeda dari `prefix` bila subpos tak ada di BTKI dan pencarian melebar ke pos 4 digit. */
  group: string | null
  suggested: string | null
  method: BtkiMatchMethod
  confidence: BtkiConfidence
  reason: string | null
}

export type BtkiMatchResponse = {
  /** Kandidat pos 8 digit per awalan. */
  groups: Record<string, BtkiCandidate[]>
  matches: BtkiMatch[]
  /** Catatan untuk pengguna, mis. AI tidak tersedia sehingga memakai pencocokan kata. */
  notice: string | null
}

export const BTKI_MATCH_MAX_ITEMS = 40

export function formatBtkiCode(code: string): string {
  if (/^\d{8}$/.test(code)) return code.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')
  if (/^\d{6}$/.test(code)) return code.replace(/(\d{4})(\d{2})/, '$1.$2')
  return code
}

/** HS invoice dengan titik setelah 4 digit pertama lalu 2 digit berikutnya: 43040091 → 4304.00.91. */
export function formatHsInvoice(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length <= 4) return raw?.trim() ?? ''
  const head = `${digits.slice(0, 4)}.${digits.slice(4, 6)}`
  return digits.length > 6 ? `${head}.${digits.slice(6)}` : head
}

/**
 * HS internasional seragam hanya sampai 6 digit; digit ke-7 dst. milik negara pengirim, jadi dibuang.
 * Invoice yang hanya menulis pos 4–5 digit dicari per pos 4 digit.
 */
export function hsPrefix(raw: string | null | undefined): HsPrefix {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length >= 6) return { prefix: digits.slice(0, 6), truncated: digits.length > 6 }
  if (digits.length >= 4) return { prefix: digits.slice(0, 4), truncated: false }
  return { prefix: null, truncated: false }
}

function depthOf(text: string): number {
  const lead = /^(?:-\s*)+/.exec(text.trim())
  return lead ? (lead[0].match(/-/g)?.length ?? 0) : 0
}

function cleanUraian(text: string): string {
  return text
    .trim()
    .replace(/^(?:-\s*)+/, '')
    .replace(/\s*:\s*$/, '')
    .trim()
}

/** Susun pos 8 digit yang bisa dipakai beserta jalur uraian induknya (tanda "-" BTKI = kedalaman). */
export function buildBtkiCandidates(rows: readonly BtkiRow[], prefix: string): BtkiCandidate[] {
  const ordered = [...rows].sort((a, b) => a.id - b.id)
  const stack: { depth: number; id: string; en: string }[] = []
  const candidates: BtkiCandidate[] = []
  const seen = new Set<string>()

  for (const row of ordered) {
    if (!row.code.startsWith(prefix) && !prefix.startsWith(row.code)) continue
    const depth = depthOf(row.uraianEn || row.uraianId)
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop()
    const id = cleanUraian(row.uraianId)
    const en = cleanUraian(row.uraianEn)
    if (row.declarable && row.code.length === 8 && row.code.startsWith(prefix) && !seen.has(row.code)) {
      seen.add(row.code)
      candidates.push({
        code: row.code,
        formatted: formatBtkiCode(row.code),
        uraianId: id,
        uraianEn: en,
        pathId: [...stack.map((entry) => entry.id), id].filter(Boolean),
        pathEn: [...stack.map((entry) => entry.en), en].filter(Boolean),
      })
    }
    stack.push({ depth, id, en })
  }
  return candidates
}

const STOPWORDS = new Set([
  'of', 'for', 'the', 'and', 'or', 'with', 'in', 'to', 'not', 'than', 'other', 'others', 'thereof',
  'dan', 'atau', 'untuk', 'dari', 'yang', 'dengan', 'lain', 'lainnya', 'tidak', 'pada', 'di',
  'set', 'pcs', 'pc', 'unit', 'new', 'type', 'model',
])

function tokens(text: string): Set<string> {
  const result = new Set<string>()
  for (const word of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word.length < 2 || STOPWORDS.has(word) || /^\d+$/.test(word)) continue
    result.add(word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)
  }
  return result
}

function isResidual(candidate: BtkiCandidate): boolean {
  return /^(other|others)$/i.test(candidate.uraianEn) || /^lain-lain$/i.test(candidate.uraianId)
}

export type LexicalMatch = { code: string | null; confidence: BtkiConfidence; reason: string }

/**
 * Cadangan tanpa AI: hitung kata uraian barang yang muncul di uraian pos (bobot 2) dan induknya
 * (bobot 1). Tanpa kecocokan, pos "Lain-lain" paling umum yang dipilih — selalu berkeyakinan rendah.
 */
export function lexicalMatch(description: string, candidates: readonly BtkiCandidate[]): LexicalMatch {
  if (candidates.length === 0) return { code: null, confidence: 'rendah', reason: 'Tidak ada kandidat pos BTKI.' }
  if (candidates.length === 1) {
    return { code: candidates[0].code, confidence: 'tinggi', reason: 'Satu-satunya pos 8 digit pada subpos ini.' }
  }

  const words = tokens(description)
  let best: { candidate: BtkiCandidate; score: number } | null = null
  let tied = false
  if (words.size > 0) {
    for (const candidate of candidates) {
      const own = tokens(`${candidate.uraianEn} ${candidate.uraianId}`)
      const parents = tokens(
        [...candidate.pathEn.slice(0, -1), ...candidate.pathId.slice(0, -1)].join(' '),
      )
      let score = 0
      for (const word of words) {
        if (own.has(word)) score += 2
        else if (parents.has(word)) score += 1
      }
      if (!best || score > best.score) {
        best = { candidate, score }
        tied = false
      } else if (score === best.score) {
        tied = true
      }
    }
  }

  if (best && best.score >= 2 && !tied) {
    return {
      code: best.candidate.code,
      confidence: best.score >= 4 ? 'sedang' : 'rendah',
      reason: 'Kata pada uraian barang cocok dengan uraian pos.',
    }
  }

  const residual = candidates
    .filter(isResidual)
    .sort((a, b) => a.pathEn.length - b.pathEn.length || b.code.localeCompare(a.code))[0]
  if (residual) {
    return {
      code: residual.code,
      confidence: 'rendah',
      reason: 'Tidak ada uraian pos yang cocok; diarahkan ke pos "Lain-lain".',
    }
  }
  return { code: null, confidence: 'rendah', reason: 'Tidak ada uraian pos yang cocok; pilih manual.' }
}
