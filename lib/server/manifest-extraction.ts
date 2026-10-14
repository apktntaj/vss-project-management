import { z } from 'zod'

import {
  exhibitorLogisticsSchema,
  inwardManifestSchema,
  type ExhibitorLogistics,
  type InwardManifest,
} from '@/domain/job/manifest'
import { assertSupportedDocumentFile, DocumentExtractionError, geminiDocumentInput } from './document-extraction'

const MODEL = 'gemini-3.5-flash-lite'

export type ManifestBlockParse = {
  agentName: string
  inward: InwardManifest
  exhibitors: Array<{ name: string; logistics: ExhibitorLogistics }>
}

export type ManifestParseResult = {
  blocks: ManifestBlockParse[]
  warnings: string[]
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const amount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const wholeNumber = (value: unknown) => {
  const parsed = amount(value)
  return parsed !== null && Number.isInteger(parsed) ? parsed : null
}

/** Tanggal manifest umumnya dd/mm/yyyy; terima juga ISO. */
function normalizeDate(value: unknown): string | null {
  const raw = text(value)
  if (!raw) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (iso) return raw
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw)
  if (dmy) {
    const [, day, month, year] = dmy
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return null
}

const prompt = `Parse this exhibition inward manifest into blocks. Each yellow header row starts one block: AGENT NAME / transport document number (BL or AWB) / configuration (LCL, or containers like 1X20', 1x20' + 1x40') / totals. Rows below list exhibitors with their package (koli) breakdown and remark milestones.

Return only JSON: {"blocks":[{"agentName":string,"transportDocument":{"kind":"BL"|"AWB","number":string},"loadConfiguration":{"kind":"LCL"}|{"kind":"FCL","containers":[{"containerNumber":string|null,"size":"K20"|"K40"|"K40HQ","sealNumber":string|null}]},"milestones":[{"kind":"ETA"|"SKEP"|"SPPB"|"STRIPPING_SELESAI"|"MASUK_BONDED"|"BAHANDLE_SELESAI"|"PERIKSA_SELESAI"|"DO_READY","date":"YYYY-MM-DD","documentNumber":string|null}],"notes":[{"kind":"ANOMALI_BARANG"|"PENAHANAN"|"LAINNYA","text":string}],"exhibitors":[{"name":string,"hall":string|null,"booth":string|null,"koliTotalCount":number,"kolis":[{"label":string|null,"lengthCm":number|null,"widthCm":number|null,"heightCm":number|null,"volumeCbm":number|null,"weightKg":number|null}]}]}]}

Rules:
- Koli rows are the CASE/PKG/PK lines with Dimension L W H per exhibitor. Header totals (total PKG/KGM/CBM of the block) are NOT koli rows; use them only as koliTotalCount hints per exhibitor (the exhibitor's own Total Package column).
- Milestones from the Remark column: "Eta" → ETA; "Skep" → SKEP (put the decree number like S-622/WBC.08/2026 in documentNumber); "SPPB" → SPPB; "Selesai stripping" → STRIPPING_SELESAI; "Masuk Bonded" → MASUK_BONDED; "Selesai Bahandle/Bahandel" → BAHANDLE_SELESAI; "Selesai periksa" → PERIKSA_SELESAI; "DO ready" → DO_READY. Convert dd/mm/yyyy dates to YYYY-MM-DD. Empty dates (just a label with ":") are skipped.
- Free remarks: sentences containing "Hold until" or blocking DO status → PENAHANAN; "barang anomali" → ANOMALI_BARANG; anything else (including "BC.27 TO <company>") → LAINNYA.
- Container sizes: 20' → K20, 40' → K40, 40'HQ → K40HQ. "LCL" blocks have no containers.
- Drop unreadable blocks instead of guessing.`

const blockPayloadSchema = z.object({
  agentName: z.string().trim().min(1),
  transportDocument: z.unknown(),
  loadConfiguration: z.unknown(),
  milestones: z.array(z.unknown()).default([]),
  notes: z.array(z.unknown()).default([]),
  exhibitors: z.array(z.unknown()).default([]),
})

function normalizeExhibitor(value: unknown): { name: string; logistics: ExhibitorLogistics } | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const name = text(input.name)
  if (!name) return null
  const kolis = Array.isArray(input.kolis) ? input.kolis : []
  const logistics = exhibitorLogisticsSchema.safeParse({
    hall: text(input.hall),
    booth: text(input.booth),
    koli: {
      totalCount: wholeNumber(input.koliTotalCount) ?? kolis.length,
      details: kolis.map((koli) => {
        const item = (koli ?? {}) as Record<string, unknown>
        const lengthCm = amount(item.lengthCm)
        const widthCm = amount(item.widthCm)
        const heightCm = amount(item.heightCm)
        return {
          label: text(item.label),
          dimension:
            lengthCm !== null && widthCm !== null && heightCm !== null
              ? { lengthCm, widthCm, heightCm }
              : null,
          volumeCbm: amount(item.volumeCbm),
          weightKg: amount(item.weightKg),
        }
      }),
    },
    notes: (Array.isArray(input.notes) ? input.notes : []).flatMap((note) => {
      const item = (note ?? {}) as Record<string, unknown>
      const noteText = text(item.text)
      return noteText ? [{ kind: item.kind, text: noteText }] : []
    }),
  })
  return logistics.success ? { name, logistics: logistics.data } : null
}

function normalizeBlock(value: unknown): ManifestBlockParse | null {
  const payload = blockPayloadSchema.safeParse(value)
  if (!payload.success) return null
  const milestoneDates = payload.data.milestones.map((milestone) => {
    const item = (milestone ?? {}) as Record<string, unknown>
    return { ...item, date: normalizeDate(item.date) }
  })
  const inward = inwardManifestSchema.safeParse({
    transportDocument: payload.data.transportDocument,
    loadConfiguration: payload.data.loadConfiguration,
    milestones: milestoneDates,
    notes: payload.data.notes,
  })
  if (!inward.success) return null
  const exhibitors = payload.data.exhibitors
    .map(normalizeExhibitor)
    .filter((exhibitor): exhibitor is { name: string; logistics: ExhibitorLogistics } => exhibitor !== null)
  return { agentName: payload.data.agentName, inward: inward.data, exhibitors }
}

/** Mem-parse file inward manifest (PDF/Excel) menjadi blok job yang sudah tervalidasi domain. */
export async function parseManifestFile(file: File): Promise<ManifestParseResult> {
  assertSupportedDocumentFile(file)
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new DocumentExtractionError('GEMINI_API_KEY belum dikonfigurasi.', 503)

  try {
    const input = await geminiDocumentInput(file)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, input] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    })
    if (!response.ok) throw new DocumentExtractionError('Manifest tidak dapat diproses oleh Gemini.', 502)
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const responseText = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text
    if (!responseText) throw new DocumentExtractionError('Gemini tidak mengembalikan data manifest.', 502)

    const parsed = JSON.parse(responseText) as { blocks?: unknown[] }
    const warnings: string[] = []
    const blocks = (Array.isArray(parsed.blocks) ? parsed.blocks : []).flatMap((block) => {
      const normalized = normalizeBlock(block)
      if (normalized) return [normalized]
      const agentName = text((block as Record<string, unknown> | null)?.agentName)
      warnings.push(agentName ? `Blok ${agentName} dilewati karena datanya tidak lengkap.` : 'Satu blok dilewati karena tidak terbaca.')
      return []
    })
    return { blocks, warnings }
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError('Manifest tidak dapat diparse. Coba lagi atau gunakan file lain.', 502)
  }
}
