import { z } from 'zod'

import {
  exhibitorLogisticsSchema,
  inwardManifestSchema,
  type ExhibitorLogistics,
  type InwardManifest,
  type Koli,
} from '@/domain/job/manifest'
import {
  barisBarangSchema,
  type BarisBarang,
  type CiplDocumentHeader,
  type DisposisiBarang,
} from '@/domain/exhibition/cipl-document'
import { reconcileKoliTotal } from '@/domain/exhibition/cipl-autofill'
import { assertSupportedDocumentFile, DocumentExtractionError } from './document-extraction'
import { configuredLlmProvider, configuredScanCiplProvider } from './extraction/config'
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
const amount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null
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

/** Instruksi parse blok inward manifest — dikirim sebagai system prompt. */
const manifestSystemPrompt = `Parse this exhibition inward manifest into blocks. Each yellow header row starts one block: AGENT NAME / transport document number (BL or AWB) / configuration (LCL, or containers like 1X20', 1x20' + 1x40') / totals. Rows below list exhibitors with their package (koli) breakdown and remark milestones.

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

function normalizeExhibitor(
  value: unknown,
): { name: string; logistics: ExhibitorLogistics } | null {
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
    .filter(
      (exhibitor): exhibitor is { name: string; logistics: ExhibitorLogistics } =>
        exhibitor !== null,
    )
  return { agentName: payload.data.agentName, inward: inward.data, exhibitors }
}

/** Mem-parse file inward manifest (PDF/Excel) menjadi blok job yang sudah tervalidasi domain. */
export async function parseManifestFile(file: File): Promise<ManifestParseResult> {
  assertSupportedDocumentFile(file)
  const provider = configuredLlmProvider()
  if (!provider) throw new DocumentExtractionError(LLM_UNAVAILABLE_MESSAGE, 503)

  try {
    const parsed = (await chatDocumentJson(
      provider,
      'Parse this inward manifest document into blocks. Return only the JSON object described.',
      file,
      manifestSystemPrompt,
    )) as { blocks?: unknown[] }
    const warnings: string[] = []
    const blocks = (Array.isArray(parsed.blocks) ? parsed.blocks : []).flatMap((block) => {
      const normalized = normalizeBlock(block)
      if (normalized) return [normalized]
      const agentName = text((block as Record<string, unknown> | null)?.agentName)
      warnings.push(
        agentName
          ? `Blok ${agentName} dilewati karena datanya tidak lengkap.`
          : 'Satu blok dilewati karena tidak terbaca.',
      )
      return []
    })
    return { blocks, warnings }
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError(
      'Manifest tidak dapat diparse. Coba lagi atau gunakan file lain.',
      502,
    )
  }
}

/** Baris exhibitor hasil smart scan CIPL; jobNo (S.01 dst.) hanya untuk ditampilkan. */
export type CiplExhibitorParse = {
  name: string
  jobNo: string | null
  logistics: ExhibitorLogistics
  /**
   * Total paket yang disebut dokumen untuk exhibitor ini (kolom "Total Package" inward manifest),
   * `null` bila dokumen tidak menyebutnya per exhibitor — lihat domain/exhibition/cipl-autofill.
   */
  statedTotalCount: number | null
  items: BarisBarang[]
}

/** Kepala dokumen CIPL (INV & PL NO., DATE, shipper, CONSIGNEE, dst.) — kosong pada inward manifest. */
export type CiplDocumentHeaderParse = CiplDocumentHeader

export type CiplScanResult = {
  header: CiplDocumentHeaderParse | null
  exhibitors: CiplExhibitorParse[]
  itemsBelumTerpetakan: BarisBarang[]
  warnings: string[]
}

/** Instruksi smart scan CIPL/manifest flat — dikirim sebagai system prompt. */
const ciplSystemPrompt = `You are an expert document extraction assistant specialized in international exhibition logistics, freight forwarding, and customs documentation.

Your responsibility is to extract structured data from exhibition cargo documents: CIPL (Commercial Invoice & Packing List), packing lists, and inward manifests.

## 1. Core principles

- Extract only information supported by the source document.
- Never invent missing information.
- Never assume one CIPL represents one exhibitor.
- Never assume one exhibitor has only one package.
- Never assume one package contains only one item.
- Preserve the original terminology used in the document.
- Distinguish between missing, unreadable, and explicitly empty values.
- Do not silently resolve conflicting information.

## 2. Document understanding

First identify: event information; shipper; consignee; invoice information; exhibitor information; hall and stand numbers; package information; goods descriptions; quantities; HS codes; country of origin; weights and dimensions; customs treatment or disposition (remarks A/B/C).

## 3. Exhibitor identification

- A document may contain multiple exhibitors. The EXHIBITOR column often uses merged cells spanning many package rows: one distinct exhibitor name = one entry, and every package/item row under that merged cell belongs to it. A consolidated CIPL like "1 document, 6 exhibitors" must produce 6 entries, not 1.
- For each exhibitor: identify the name, the hall and stand/booth number, and associate goods and packages with the correct exhibitor only when supported by the document.
- The header CONSIGNEE is the exhibition venue/organizer (e.g. PT. JAKARTA INTERNATIONAL EXPO), NEVER one of the exhibitors from the table.
- If a row cannot be associated with any exhibitor, put its items into "itemsBelumTerpetakan" instead of guessing.

## 4. Package identification

- Distinguish package type, package identifier/case number, number of packages, and goods inside packages. Preserve the original package terminology and label text ("PKG 1", "PK 2", "7-11") — do not rename or renumber.
- CASE/PKG/PK rows carrying Dimension L W H are koli rows. Copy each row's package-number cell into "label" EXACTLY as printed — "1", "PKG 1", "PK 2", a range "7-11", or the literal "in package No. 22" — because the package count is computed from that text, not from the number of rows. Never rewrite a range as a single number and never expand it into several rows.
- koliTotalCount = the exhibitor's own "Total Package" column ONLY when the document prints one per exhibitor (inward manifests do; consolidated CIPLs do not). Use null when it does not — do NOT count rows yourself, and NEVER use the document footer "TTL: N PACKAGES", which belongs to the whole container. A "Bare Case" column value (e.g. "7 PKG") goes to bareCaseCount as written; null when the row shows none.
- Bottom totals (sum CBM / weight per job, TTL, TOTAL CIF AMOUNT) are neither koli rows nor items; skip them.

## 5. Goods extraction

For each goods entry extract: original description (uraian), model/brand text (merekModel), HS code (kodeHs), quantity (jumlah), unit of measurement (satuan), unit value (nilaiSatuan), total value (nilaiTotal), and the customs disposition read from the remarks mark per item row: A (RE-EXPORT AFTER EXHIBITION) → "A", B (DISPOSED OR CONSUMED) → "B", C (GIVE AWAY/SOLD) → "C", null when unmarked (disposisi). refKoli is the package number or range the item sits in, exactly as written ("7-11", "22", "in package No. 22"); null when unclear.
- Do not merge different goods descriptions just because they share the same HS code.
- Scan ALL pages of the document.

## 6. Validation

- Report inconsistencies in "issues" without changing original values: quantities vs package totals, unit value × quantity vs total value, package totals across pages, ambiguous package assignments, conflicts between pages, unreadable rows.

## 7. Output

Return compact minified JSON only (no spaces or newlines between tokens). OMIT every field whose value is null, empty, zero-unknown, or not present in the document — do not emit the key at all. Only these are required: each exhibitor's "name"; each item's "uraian" and "jumlah". Everything else is optional and MUST be omitted when absent. Field reference (shown with the null variants only to name the keys — in your output omit those keys instead of sending null):
{"document":{"nomor":string,"tanggal":"YYYY-MM-DD","pengirim":string,"penerima":string,"namaPameran":string,"incoterm":string,"mataUang":string,"infoKontainer":string,"nilaiTotalDeklarasi":number},"exhibitors":[{"name":string,"jobNo":string,"hall":string,"booth":string,"bareCaseCount":number,"koliTotalCount":number,"kolis":[{"exhibitor":string,"label":string,"satuanKemasan":string,"lengthCm":number,"widthCm":number,"heightCm":number,"volumeCbm":number,"weightKg":number}],"items":[{"exhibitor":string,"uraian":string,"merekModel":string,"kodeHs":string,"jumlah":number,"satuan":string,"nilaiSatuan":number,"nilaiTotal":number,"disposisi":"A"|"B"|"C","refKoli":string}]}],"itemsBelumTerpetakan":[same item shape],"issues":[string]}

Rules for the output shape:
- The EXHIBITOR column is a merged cell spanning all package/item rows of that exhibitor. Those rows already sit nested inside their exhibitor's "kolis"/"items", so DO NOT repeat the exhibitor name on every row. Set a koli/item "exhibitor" field ONLY when that single row actually belongs to a DIFFERENT exhibitor than the entry it is nested under (rare split cases); omit it otherwise.
- "document" is the CIPL / commercial invoice header: "INV & PL NO." → nomor, "DATE" → tanggal, the shipper block (top-left address, e.g. a logistics company) → pengirim, "CONSIGNEE" block → penerima, exhibition name line → namaPameran, incoterm (CIF/FOB...) → incoterm, currency → mataUang, "CONTAINER:" footer → infoKontainer, "TOTAL CIF AMOUNT" → nilaiTotalDeklarasi. All null when the document is an inward manifest without such a header.
- In an inward manifest, one job row (S.01, S.02, ...) can list one or more exhibitor names; output one entry per named exhibitor with that row's package breakdown, hall and booth. jobNo is the row's job number (e.g. "S.01"), null when absent.
- For a packing list or CIPL without per-case dimensions, still return the exhibitor (buyer/consignee) with koliTotalCount from its totals and kolis from whatever per-package lines exist.
- "satuanKemasan" (inside each kolis entry) is THAT package's unit/type read from the package-type column or label (e.g. "CARTON", "WOODEN CASE", "PALLET", "KOLI"); omit the key when the package type is not stated.
- Drop unreadable rows instead of guessing, and say so in "issues".`

const disposisiFromMark = (mark: unknown): DisposisiBarang =>
  mark === 'A'
    ? 'RE_EXPORT'
    : mark === 'B'
      ? 'DISPOSED'
      : mark === 'C'
        ? 'GIVE_AWAY'
        : 'TIDAK_DISEBUT'

function normalizeCiplItem(value: unknown): BarisBarang | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const uraian = text(input.uraian)
  const jumlah = amount(input.jumlah)
  if (!uraian || jumlah === null || jumlah <= 0) return null
  const parsed = barisBarangSchema.safeParse({
    uraian,
    merekModel: text(input.merekModel),
    kodeHs: text(input.kodeHs),
    jumlah,
    satuan: text(input.satuan) ?? 'UNIT',
    nilaiSatuan: amount(input.nilaiSatuan),
    nilaiTotal: amount(input.nilaiTotal),
    disposisi: disposisiFromMark(input.disposisi),
    refKoli: text(input.refKoli),
  })
  return parsed.success ? parsed.data : null
}

function normalizeCiplItems(
  value: unknown,
): Array<{ exhibitor: string | null; item: BarisBarang }> {
  return (Array.isArray(value) ? value : []).flatMap((value) => {
    const exhibitor = text((value as Record<string, unknown> | null)?.exhibitor)
    const item = normalizeCiplItem(value)
    return item ? [{ exhibitor, item }] : []
  })
}

function normalizeCiplHeader(value: unknown): CiplDocumentHeaderParse | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const nomor = text(input.nomor)
  const pengirim = text(input.pengirim)
  const penerima = text(input.penerima)
  if (!nomor && !pengirim && !penerima) return null
  return {
    nomor,
    tanggal: normalizeDate(input.tanggal),
    pengirim,
    penerima,
    namaPameran: text(input.namaPameran),
    incoterm: text(input.incoterm),
    mataUang: text(input.mataUang),
    infoKontainer: text(input.infoKontainer),
    nilaiTotalDeklarasi: amount(input.nilaiTotalDeklarasi),
  }
}

type RawKoliRow = { exhibitor: string | null; koli: Koli }
type RawItemRow = { exhibitor: string | null; item: BarisBarang }
type RawExhibitorEntry = {
  name: string
  jobNo: string | null
  hall: string | null
  booth: string | null
  bareCaseCount: number | null
  koliTotalCount: number | null
  koliRows: RawKoliRow[]
  itemRows: RawItemRow[]
}

function normalizeCiplKoliRow(value: unknown): RawKoliRow | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const lengthCm = amount(item.lengthCm)
  const widthCm = amount(item.widthCm)
  const heightCm = amount(item.heightCm)
  return {
    exhibitor: text(item.exhibitor),
    koli: {
      label: text(item.label),
      satuanKemasan: text(item.satuanKemasan),
      dimension:
        lengthCm !== null && widthCm !== null && heightCm !== null
          ? { lengthCm, widthCm, heightCm }
          : null,
      volumeCbm: amount(item.volumeCbm),
      weightKg: amount(item.weightKg),
    },
  }
}

function normalizeCiplExhibitor(value: unknown): RawExhibitorEntry | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const name = text(input.name)
  if (!name) return null
  const kolis = Array.isArray(input.kolis) ? input.kolis : []
  return {
    name,
    jobNo: text(input.jobNo),
    hall: text(input.hall),
    booth: text(input.booth),
    bareCaseCount: wholeNumber(input.bareCaseCount),
    koliTotalCount: wholeNumber(input.koliTotalCount),
    koliRows: kolis.map(normalizeCiplKoliRow).filter((row): row is RawKoliRow => row !== null),
    itemRows: normalizeCiplItems(input.items),
  }
}

const groupKey = (value: string | null | undefined) =>
  value ? value.toLowerCase().replace(/[^a-z0-9]+/g, '') : ''

/**
 * Kelompokkan ulang baris koli/item per exhibitor berdasar nama yang diulang di tiap
 * baris (sel gabungan). Bila partisi benar-benar memecah entri (CIPL konsolidasi),
 * jumlah koli per grup dihitung dari barisnya — total level entri berupa salinan total
 * dokumen tidak dipercaya.
 */
function partitionCiplRows(entries: RawExhibitorEntry[]): CiplExhibitorParse[] {
  type Group = {
    name: string
    jobNo: string | null
    hall: string | null
    booth: string | null
    bareCaseCount: number | null
    totalCountHint: number | null
    details: Koli[]
    items: BarisBarang[]
  }
  const groups = new Map<string, Group>()
  const ensure = (name: string, key: string): Group => {
    const existing = groups.get(key)
    if (existing) return existing
    const group: Group = {
      name,
      jobNo: null,
      hall: null,
      booth: null,
      bareCaseCount: null,
      totalCountHint: null,
      details: [],
      items: [],
    }
    groups.set(key, group)
    return group
  }

  for (const entry of entries) {
    const entryKey = groupKey(entry.name)
    for (const row of entry.koliRows) {
      const group = ensure(row.exhibitor ?? entry.name, groupKey(row.exhibitor) || entryKey)
      group.details.push(row.koli)
    }
    for (const row of entry.itemRows) {
      const group = ensure(row.exhibitor ?? entry.name, groupKey(row.exhibitor) || entryKey)
      group.items.push(row.item)
    }
    const own = groups.get(entryKey)
    if (own) {
      own.jobNo ??= entry.jobNo
      own.hall ??= entry.hall
      own.booth ??= entry.booth
      own.bareCaseCount ??= entry.bareCaseCount
      // null dipertahankan: "dokumen tidak menyebut total per exhibitor" berbeda artinya dari
      // "dokumen menyebut 0" — pembedaan itu yang menentukan apakah label koli berwenang.
      own.totalCountHint =
        own.totalCountHint === null && entry.koliTotalCount === null
          ? null
          : Math.max(own.totalCountHint ?? 0, entry.koliTotalCount ?? 0)
    } else {
      const group = ensure(entry.name, entryKey)
      group.jobNo = entry.jobNo
      group.hall = entry.hall
      group.booth = entry.booth
      group.bareCaseCount = entry.bareCaseCount
      group.totalCountHint = entry.koliTotalCount
    }
  }

  const partitioned = groups.size > entries.length
  return [...groups.values()]
    .map((group) => {
      // Saat partisi memecah entri (CIPL konsolidasi), total level entri adalah salinan total
      // dokumen — ia TIDAK menyebut total per exhibitor, jadi label barislah yang berwenang.
      const statedTotalCount = partitioned ? null : group.totalCountHint
      const totalCount = reconcileKoliTotal(group.details, statedTotalCount)
      const logistics = exhibitorLogisticsSchema.safeParse({
        hall: group.hall,
        booth: group.booth,
        koli: { totalCount, bareCaseCount: group.bareCaseCount, details: group.details },
        notes: [],
      })
      if (!logistics.success) return null
      return {
        name: group.name,
        jobNo: group.jobNo,
        logistics: logistics.data,
        statedTotalCount: statedTotalCount ?? null,
        items: group.items,
      }
    })
    .filter((entry): entry is CiplExhibitorParse => entry !== null)
}

/** Smart scan slide CIPL: inward manifest atau packing list/CIPL menjadi daftar exhibitor + koli + item. */
export async function parseCiplExhibitors(file: File): Promise<CiplScanResult> {
  assertSupportedDocumentFile(file)
  const provider = configuredScanCiplProvider()
  if (!provider) throw new DocumentExtractionError(LLM_UNAVAILABLE_MESSAGE, 503)

  try {
    const parsed = (await chatDocumentJson(
      provider,
      'Parse this document into exhibitor rows with their koli and item lines. Return only the JSON object described.',
      file,
      ciplSystemPrompt,
      300_000,
    )) as {
      document?: unknown
      exhibitors?: unknown[]
      itemsBelumTerpetakan?: unknown[]
      issues?: unknown[]
    }
    const warnings: string[] = (Array.isArray(parsed.issues) ? parsed.issues : []).flatMap(
      (issue) => {
        const message = text(issue)
        return message ? [`AI: ${message}`] : []
      },
    )
    const rawEntries = (Array.isArray(parsed.exhibitors) ? parsed.exhibitors : []).flatMap(
      (row) => {
        const normalized = normalizeCiplExhibitor(row)
        if (normalized) return [normalized]
        warnings.push('Satu baris exhibitor dilewati karena tidak terbaca.')
        return []
      },
    )
    const exhibitors = partitionCiplRows(rawEntries)
    const header = normalizeCiplHeader(parsed.document)
    const itemsBelumTerpetakan = normalizeCiplItems(parsed.itemsBelumTerpetakan).map(
      (row) => row.item,
    )
    if (!header && itemsBelumTerpetakan.length) {
      warnings.push(
        'Ada baris barang tanpa kepala dokumen — barang tidak terpilah tidak dapat disimpan.',
      )
    }
    return { header, exhibitors, itemsBelumTerpetakan, warnings }
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error
    throw new DocumentExtractionError(
      'Dokumen tidak dapat dipindai. Coba lagi atau gunakan file lain.',
      502,
    )
  }
}
