import { z } from 'zod'

import {
  exhibitorLogisticsSchema,
  inwardManifestSchema,
  type ExhibitorLogistics,
  type InwardManifest,
} from '@/domain/job/manifest'
import { assertSupportedDocumentFile, DocumentExtractionError } from './document-extraction'
import { configuredLlmProvider } from './extraction/config'
import { LLM_UNAVAILABLE_MESSAGE } from './extraction/errors'
import { chatDocumentJson } from './extraction/llm/document-json'

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
  const provider = configuredLlmProvider()
  if (!provider) throw new DocumentExtractionError(LLM_UNAVAILABLE_MESSAGE, 503)

  try {
    const parsed = (await chatDocumentJson(provider.id, provider, prompt, file)) as { blocks?: unknown[] }
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

/** Baris exhibitor hasil smart scan CIPL; jobNo (S.01 dst.) hanya untuk ditampilkan. */
export type CiplExhibitorParse = {
  name: string
  jobNo: string | null
  logistics: ExhibitorLogistics
}

export type CiplScanResult = {
  exhibitors: CiplExhibitorParse[]
  warnings: string[]
}

const ciplPrompt = `Parse this exhibition cargo document (inward manifest, packing list, or CIPL) into a FLAT list of exhibitor rows with their package (case/koli) breakdown.

Return only JSON: {"exhibitors":[{"name":string,"jobNo":string|null,"hall":string|null,"booth":string|null,"bareCaseCount":number|null,"koliTotalCount":number,"kolis":[{"label":string|null,"lengthCm":number|null,"widthCm":number|null,"heightCm":number|null,"volumeCbm":number|null,"weightKg":number|null}]}]}

Rules:
- In an inward manifest, one job row (S.01, S.02, ...) can list one or more exhibitor names; output one entry per named exhibitor with that row's package breakdown, hall and booth. jobNo is the row's job number (e.g. "S.01"), null when absent.
- CASE/PKG/PK lines carrying Dimension L W H are koli rows. The "Total Package" column (e.g. "3 PKG") is koliTotalCount, never a koli row. A "Bare Case" column value (e.g. "7 PKG") is bareCaseCount; null when the row shows no bare case value.
- Bottom row totals (sum CBM / weight per job) are NOT koli rows; skip them.
- For a packing list or CIPL without per-case dimensions, still return the exhibitor (buyer/consignee) with koliTotalCount from its totals and kolis from whatever per-package lines exist.
- Drop unreadable rows instead of guessing.`

function normalizeCiplExhibitor(value: unknown): CiplExhibitorParse | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const name = text(input.name)
  if (!name) return null
  const kolis = Array.isArray(input.kolis) ? input.kolis : []
  const parsedCount = wholeNumber(input.koliTotalCount)
  const totalCount = Math.max(parsedCount ?? 0, kolis.length)
  const logistics = exhibitorLogisticsSchema.safeParse({
    hall: text(input.hall),
    booth: text(input.booth),
    koli: {
      totalCount,
      bareCaseCount: wholeNumber(input.bareCaseCount),
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
    notes: [],
  })
  if (!logistics.success) return null
  return { name, jobNo: text(input.jobNo), logistics: logistics.data }
}

/** Smart scan slide CIPL: inward manifest atau packing list/CIPL menjadi daftar exhibitor + koli. */
export async function parseCiplExhibitors(file: File): Promise<CiplScanResult> {
  assertSupportedDocumentFile(file)
  const provider = configuredLlmProvider()
  if (!provider) throw new DocumentExtractionError(LLM_UNAVAILABLE_MESSAGE, 503)

  try {
    const parsed = (await chatDocumentJson(provider.id, provider, ciplPrompt, file)) as {
      exhibitors?: unknown[]
    }
    const warnings: string[] = []
    const exhibitors = (Array.isArray(parsed.exhibitors) ? parsed.exhibitors : []).flatMap((row) => {
      const normalized = normalizeCiplExhibitor(row)
      if (normalized) return [normalized]
      warnings.push('Satu baris exhibitor dilewati karena tidak terbaca.')
      return []
    })
    return { exhibitors, warnings }
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError('Dokumen tidak dapat dipindai. Coba lagi atau gunakan file lain.', 502)
  }
}
