import { readFile } from 'node:fs/promises'

export type LookupStatus = 'found' | 'not-found' | 'invalid' | 'source-error'
export type LartasVerification = 'verified' | 'unverified'
export type DataSource = 'insw-cms' | 'insw-public-list' | null

export interface LartasDetail {
  idDokumen: string | null
  kodeIzin: string | null
  namaIzin: string | null
  komoditi: string | null
  noSkep: string | null
  uraianBarangSkep: string | null
  hsCode: string | null
  tanggalMulai: string | null
  tanggalAkhir: string | null
  link: string | null
  links: string[]
  dokumenPabean: string[]
}

export interface HsCodeLookupResult {
  hsCode: string
  lookupStatus: LookupStatus
  dataSource: DataSource
  tariffs: {
    bm: string | null
    ppn: string | null
    pph: string | null
    pphNonApi: string | null
  }
  lartas: {
    verification: LartasVerification
    import: boolean
    border: boolean
    postBorder: boolean
    export: boolean
    importDetails: LartasDetail[]
    borderDetails: LartasDetail[]
    postBorderDetails: LartasDetail[]
    exportDetails: LartasDetail[]
  }
  error: string | null
}

export interface LookupConfig {
  baseUrl: string
  token?: string
  tokenFilePath?: string
  timeoutMs: number
  clientId?: string
  clientBearer?: string
}

type JsonRecord = Record<string, unknown>

const HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  origin: 'https://insw.go.id',
  referer: 'https://insw.go.id/',
}

/** Checks one Indonesian 8-digit HS code against INSW CMS, with a tariff-only public fallback. */
export async function lookupHsCode(
  rawCode: string,
  config: LookupConfig,
  signal?: AbortSignal,
): Promise<HsCodeLookupResult> {
  const hsCode = rawCode.replace(/\D/g, '')
  if (!/^\d{8}$/.test(hsCode)) return emptyResult(hsCode, 'invalid')

  const baseUrl = config.baseUrl.replace(/\/+$/, '')
  const token = await resolveCmsToken(config, signal)

  if (token) {
    try {
      const cmsResult = await fetchCmsResult(hsCode, baseUrl, token, config.timeoutMs, signal)
      if (cmsResult) return cmsResult
    } catch (error) {
      if (signal?.aborted) throw error
      // The public endpoint is still useful for tariff data when CMS is unavailable.
    }
  }

  try {
    return await fetchPublicResult(hsCode, baseUrl, config.timeoutMs, signal)
  } catch (error) {
    if (signal?.aborted) throw error
    const message = error instanceof Error ? error.message : String(error)
    return emptyResult(hsCode, 'source-error', message)
  }
}

export async function lookupHsCodes(
  codes: readonly string[],
  config: LookupConfig,
  signal?: AbortSignal,
): Promise<HsCodeLookupResult[]> {
  const results = new Array<HsCodeLookupResult>(codes.length)
  for (let start = 0; start < codes.length; start += 8) {
    const batch = codes.slice(start, start + 8)
    await Promise.all(batch.map(async (code, index) => {
      signal?.throwIfAborted()
      results[start + index] = await lookupHsCode(code, config, signal)
    }))
  }
  return results
}

async function fetchCmsResult(
  hsCode: string,
  baseUrl: string,
  token: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<HsCodeLookupResult | null> {
  const headers = { ...HEADERS, authorization: `Basic ${stripAuthPrefix(token)}` }
  const searchUrl = new URL('/api/cms/hscode', baseUrl)
  searchUrl.searchParams.set('keyword', hsCode)
  searchUrl.searchParams.set('size', '200')
  searchUrl.searchParams.set('from', '0')

  const search = await fetchJson(searchUrl, headers, timeoutMs, signal)
  if (extractList(search).length === 0) return null

  const detailUrl = new URL('/api/cms/detail-komoditas', baseUrl)
  detailUrl.searchParams.set('hsCode', hsCode)
  const detail = await fetchJson(detailUrl, headers, timeoutMs, signal)
  const payload = firstRecord(detail)
  return payload ? mapCmsResult(hsCode, payload) : null
}

async function fetchPublicResult(
  hsCode: string,
  baseUrl: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<HsCodeLookupResult> {
  const response = await fetchJson(new URL('/api-prod/ref/hscode', baseUrl), HEADERS, timeoutMs, signal)
  const match = extractList(response).find((row) => rowContainsHsCode(row, hsCode))
  if (!match) return emptyResult(hsCode, 'not-found')

  return {
    ...emptyResult(hsCode, 'found'),
    dataSource: 'insw-public-list',
    tariffs: {
      bm: tariffValue(match.bmMfn ?? match.bm ?? match.bm_mfn),
      ppn: tariffValue(match.ppn ?? match.ppnBm ?? match.ppn_bm),
      pph: tariffValue(match.pph ?? match.pphApi ?? match.pph_api),
      pphNonApi: tariffValue(match.pphNonApi ?? match.pph_non_api ?? match.pphNonAPI),
    },
  }
}

async function fetchJson(
  url: URL,
  headers: Record<string, string>,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<JsonRecord> {
  const controller = new AbortController()
  const abort = () => controller.abort(outerSignal?.reason)
  outerSignal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`INSW tidak tersedia (HTTP ${response.status}).`)
    const json: unknown = await response.json()
    if (!isRecord(json)) throw new Error('Respons INSW tidak valid.')
    return json
  } catch (error) {
    if (outerSignal?.aborted) throw error
    if (controller.signal.aborted) throw new Error(`INSW tidak merespons dalam ${timeoutMs} ms.`)
    throw error
  } finally {
    clearTimeout(timeout)
    outerSignal?.removeEventListener('abort', abort)
  }
}

async function resolveCmsToken(config: LookupConfig, signal?: AbortSignal): Promise<string | null> {
  if (config.clientId?.trim() && config.clientBearer?.trim()) {
    try {
      const headers = {
        authorization: `Bearer ${stripAuthPrefix(config.clientBearer)}`,
        origin: 'https://www.insw.go.id',
        referer: 'https://www.insw.go.id/',
        accept: '*/*',
      }
      const clientId = encodeURIComponent(config.clientId.trim())
      const jwks = await fetchJson(new URL(`/api/v1/client/${clientId}/jwks`, 'https://sso.insw.go.id'), headers, config.timeoutMs, signal)
      const isc = stringValue(jwks.isc)
      if (isc) {
        const tokenResponse = await fetchJson(new URL(`/api/v1/client/${clientId}/token`, 'https://sso.insw.go.id'), { ...headers, 'x-sign-for': isc }, config.timeoutMs, signal)
        const refreshedToken = stringValue(tokenResponse.token)
        if (refreshedToken) return refreshedToken
      }
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }
  return readToken(config)
}

async function readToken(config: LookupConfig): Promise<string | null> {
  if (config.token?.trim()) return config.token.trim()
  if (!config.tokenFilePath) return null
  try {
    const token = (await readFile(config.tokenFilePath, 'utf8')).trim()
    return token || null
  } catch {
    return null
  }
}

function mapCmsResult(hsCode: string, data: JsonRecord): HsCodeLookupResult {
  const tariffs = Array.isArray(data.informasiTarif) ? data.informasiTarif.filter(isRecord) : []
  const getTariff = (matcher: (label: string) => boolean): string | null => {
    const match = tariffs.find((item) => matcher(String(item.label ?? '').toLowerCase()))
    return tariffValue(match?.value)
  }
  const documentLinks = buildDocumentLinkMap(data.dokPabean)
  const borderDetails = attachDocumentLinks(extractRegulations(data.regulasiImporBorder), documentLinks)
  const postBorderDetails = attachDocumentLinks(extractRegulations(data.regulasiImporPostborder), documentLinks)
  const exportDetails = attachDocumentLinks(extractRegulations(data.regulasiEkspor), documentLinks)
  const importDetails = mergeDetails([...borderDetails, ...postBorderDetails])

  return {
    hsCode,
    lookupStatus: 'found',
    dataSource: 'insw-cms',
    tariffs: {
      bm: getTariff((label) => label.includes('bm mfn') || label === 'bm'),
      ppn: getTariff((label) => label === 'ppn'),
      pph: getTariff((label) => label.includes('pph') && !label.includes('non')),
      pphNonApi: getTariff((label) => label.includes('pph') && label.includes('non')),
    },
    lartas: {
      verification: 'verified',
      import: importDetails.length > 0,
      border: borderDetails.length > 0,
      postBorder: postBorderDetails.length > 0,
      export: exportDetails.length > 0,
      importDetails,
      borderDetails,
      postBorderDetails,
      exportDetails,
    },
    error: null,
  }
}

function extractRegulations(value: unknown): LartasDetail[] {
  if (!isRecord(value)) return []
  const details = new Map<string, LartasDetail>()
  for (const [documentCode, rawEntries] of Object.entries(value)) {
    if (!Array.isArray(rawEntries)) continue
    for (const rawEntry of rawEntries) {
      if (!isRecord(rawEntry)) continue
      const key = [rawEntry.id_dokumen, rawEntry.kd_ijin, rawEntry.ur_ijin, rawEntry.no_skep].map((item) => stringValue(item) ?? '').join('|')
      const existing = details.get(key)
      const customsDocuments = new Set(existing?.dokumenPabean ?? [])
      customsDocuments.add(documentCode)
      if (Array.isArray(rawEntry.dok_pabean)) {
        for (const code of rawEntry.dok_pabean) customsDocuments.add(String(code))
      }
      const link = regulationLink(rawEntry) ?? existing?.link ?? null
      details.set(key, {
        idDokumen: stringValue(rawEntry.id_dokumen),
        kodeIzin: stringValue(rawEntry.kd_ijin),
        namaIzin: stringValue(rawEntry.ur_ijin),
        komoditi: stringValue(rawEntry.komoditi),
        noSkep: stringValue(rawEntry.no_skep),
        uraianBarangSkep: stringValue(rawEntry.ur_brg_skep),
        hsCode: stringValue(rawEntry.hs_code),
        tanggalMulai: stringValue(rawEntry.tgl_awal),
        tanggalAkhir: stringValue(rawEntry.tgl_akhir),
        link,
        links: existing?.links ?? [],
        dokumenPabean: [...customsDocuments].sort(),
      })
    }
  }
  return [...details.values()]
}

function buildDocumentLinkMap(value: unknown): Map<string, string> {
  const links = new Map<string, string>()
  if (!isRecord(value)) return links
  for (const rawEntries of Object.values(value)) {
    if (!Array.isArray(rawEntries)) continue
    for (const rawEntry of rawEntries) {
      if (!isRecord(rawEntry)) continue
      const code = stringValue(rawEntry.kd_dokumen)
      const link = regulationLink(rawEntry)
      if (code && link && !links.has(code)) links.set(code, link)
    }
  }
  return links
}

function attachDocumentLinks(details: LartasDetail[], documentLinks: Map<string, string>): LartasDetail[] {
  return details.map((detail) => {
    const links = [...new Set([...detail.links, ...detail.dokumenPabean.map((code) => documentLinks.get(code)).filter(isString)])]
    return { ...detail, links, link: detail.link ?? links[0] ?? null }
  })
}

function mergeDetails(details: LartasDetail[]): LartasDetail[] {
  const merged = new Map<string, LartasDetail>()
  for (const detail of details) {
    const key = [detail.idDokumen, detail.kodeIzin, detail.namaIzin, detail.noSkep].join('|')
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...detail })
      continue
    }
    merged.set(key, {
      ...existing,
      link: existing.link ?? detail.link,
      links: [...new Set([...existing.links, ...detail.links])],
      dokumenPabean: [...new Set([...existing.dokumenPabean, ...detail.dokumenPabean])].sort(),
    })
  }
  return [...merged.values()]
}

function regulationLink(entry: JsonRecord): string | null {
  const raw = [entry.file_path, entry.filePath, entry.ket_link, entry.ketLink, entry.url, entry.link, entry.document_url].find(isString)
  if (!raw) return null
  if (/^https?:\/\//.test(raw)) return raw
  if (raw.startsWith('./')) return `https://api.insw.go.id/${raw.slice(2)}`
  if (raw.startsWith('/')) return `https://api.insw.go.id${raw}`
  return null
}

function emptyResult(hsCode: string, lookupStatus: LookupStatus, error: string | null = null): HsCodeLookupResult {
  return {
    hsCode,
    lookupStatus,
    dataSource: null,
    tariffs: { bm: null, ppn: null, pph: null, pphNonApi: null },
    lartas: { verification: 'unverified', import: false, border: false, postBorder: false, export: false, importDetails: [], borderDetails: [], postBorderDetails: [], exportDetails: [] },
    error,
  }
}

function extractList(json: JsonRecord): JsonRecord[] {
  const data = json.data
  if (Array.isArray(data)) return data.filter(isRecord)
  if (!isRecord(data)) return []
  if (Array.isArray(data.items)) return data.items.filter(isRecord)
  if (Array.isArray(data.results)) return data.results.filter(isRecord)
  return []
}

function firstRecord(json: JsonRecord): JsonRecord | null {
  const data = json.data
  return Array.isArray(data) ? data.find(isRecord) ?? null : isRecord(data) ? data : null
}

function rowContainsHsCode(row: JsonRecord, hsCode: string): boolean {
  return [row.hsCodeFormat, row.kodeHsCode, row.hsCode, row.hs_code].some((value) => String(value ?? '').replace(/\D/g, '') === hsCode)
}

function stripAuthPrefix(token: string): string {
  return token.replace(/^(Basic|Bearer)\s+/i, '').trim()
}

function tariffValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return !text || text.toUpperCase() === 'N/A' ? null : text
}

function stringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
