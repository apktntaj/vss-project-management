import 'server-only'

import { z } from 'zod'
import type { CeisaExchangeRateObservation, CeisaLocationReference, CeisaManifestEntry, CeisaStatusObservation, CeisaTariffObservation } from '@/domain/ceisa/types'
import { ceisaCredentials } from './repository'

export class CeisaError extends Error {
  constructor(readonly code: 'CEISA_UNAVAILABLE' | 'CEISA_CONTRACT_MISMATCH' | 'CEISA_NOT_FOUND', message = 'CEISA service is unavailable.') { super(message) }
}
type Token = { value: string; expiresAt: number }
const tokens = new Map<string, Token>()
const logins = new Map<string, Promise<Token>>()
const timeoutMs = () => { const value = Number(process.env.CEISA_REQUEST_TIMEOUT_MS); return Number.isFinite(value) && value > 0 ? value : 30_000 }
const base = (name: 'CEISA_BASE_URL' | 'CEISA_AUTH_BASE_URL') => { const value = process.env[name]?.trim(); if (!value?.startsWith('https://') && !value?.startsWith('http://')) throw new CeisaError('CEISA_UNAVAILABLE'); return value.replace(/\/$/, '') }
const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive().optional() }).passthrough()
const loginResponseSchema = z.union([
  tokenSchema,
  z.object({ status: z.string(), message: z.string(), item: tokenSchema }).passthrough(),
])

function expiry(token: string, seconds?: number) {
  if (seconds) return Date.now() + seconds * 1000 - 30_000
  try { const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { exp?: number }; if (typeof payload.exp === 'number') return payload.exp * 1000 - 30_000 } catch { /* first 401 invalidates an unknown expiry */ }
  return Date.now() + 4 * 60_000
}

async function login(workspaceId: string) {
  const existing = tokens.get(workspaceId)
  if (existing && existing.expiresAt > Date.now()) return existing
  const pending = logins.get(workspaceId)
  if (pending) return pending
  const request = (async () => {
    const { credentials } = await ceisaCredentials()
    let response: Response
    try { response = await fetch(`${base('CEISA_AUTH_BASE_URL')}/user/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: credentials.username, password: credentials.password }), signal: AbortSignal.timeout(timeoutMs()), cache: 'no-store' }) } catch { throw new CeisaError('CEISA_UNAVAILABLE') }
    if (!response.ok) throw new CeisaError('CEISA_UNAVAILABLE', 'CEISA authentication failed.')
    const parsed = loginResponseSchema.safeParse(await response.json().catch(() => null))
    if (!parsed.success) throw new CeisaError('CEISA_CONTRACT_MISMATCH')
    const payload = tokenSchema.parse('item' in parsed.data ? parsed.data.item : parsed.data)
    const token = { value: payload.access_token, expiresAt: expiry(payload.access_token, payload.expires_in) }
    tokens.set(workspaceId, token)
    return token
  })()
  logins.set(workspaceId, request)
  try { return await request } finally { logins.delete(workspaceId) }
}

function relativeDownloadPath(path: string) {
  if (!path || path.startsWith('/') || path.includes('..') || /[\\:?#]/.test(path)) throw new CeisaError('CEISA_CONTRACT_MISMATCH', 'Invalid CEISA download path.')
  return path
}

function unwrap(value: unknown) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.data)) return record.data
    if (record.data && typeof record.data === 'object') return record.data
  }
  return value
}
const recordSchema = z.record(z.unknown())
function text(record: Record<string, unknown>, ...keys: string[]) { for (const key of keys) if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim(); return undefined }
function number(record: Record<string, unknown>, ...keys: string[]) { for (const key of keys) { const value = record[key]; if (typeof value === 'number' && Number.isFinite(value)) return value; if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value) } return undefined }

export class CeisaClient {
  async request(path: string, query?: Record<string, string>, binary = false) {
    const { workspaceId, credentials } = await ceisaCredentials()
    const call = async () => {
      const url = new URL(`${base('CEISA_BASE_URL')}/${path.replace(/^\//, '')}`)
      Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value))
      const token = await login(workspaceId)
      try { return await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token.value}`, 'beacukai-api-key': credentials.apiKey, ...(credentials.idPlatform ? { id_platform: credentials.idPlatform } : {}), ...(process.env.CEISA_ORIGIN ? { Origin: process.env.CEISA_ORIGIN } : {}) }, signal: AbortSignal.timeout(timeoutMs()), cache: 'no-store' }) } catch { throw new CeisaError('CEISA_UNAVAILABLE') }
    }
    let response = await call()
    if (response.status === 401) { tokens.delete(workspaceId); response = await call() }
    if (response.status === 404) throw new CeisaError('CEISA_NOT_FOUND')
    if (!response.ok) throw new CeisaError('CEISA_UNAVAILABLE')
    if (binary) { const bytes = new Uint8Array(await response.arrayBuffer()); const header = response.headers.get('content-type') ?? ''; if (!header.includes('pdf') && new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new CeisaError('CEISA_CONTRACT_MISMATCH'); return { bytes, contentType: 'application/pdf' } }
    const payload = await response.json().catch(() => { throw new CeisaError('CEISA_CONTRACT_MISMATCH') })
    return payload
  }

  async getStatusBySubmissionNumber(submissionNumber: string): Promise<CeisaStatusObservation> { const raw = unwrap(await this.request(`status/${encodeURIComponent(submissionNumber)}`)); const row = recordSchema.safeParse(raw); if (!row.success) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); const responseCode = text(row.data, 'responseCode', 'kodeRespon', 'kode_respon'); const responseName = text(row.data, 'responseName', 'namaRespon', 'nama_respon'); if (!responseCode || !responseName) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); return { documentType: text(row.data, 'documentType', 'jenisDokumen', 'jenis_dokumen') ?? '', submissionNumber, responseCode, responseName, observedAt: new Date().toISOString(), registrationNumber: text(row.data, 'registrationNumber', 'nomorDaftar', 'nomor_daftar'), registrationDate: text(row.data, 'registrationDate', 'tanggalDaftar', 'tanggal_daftar'), responsePath: text(row.data, 'responsePath', 'path'), billingCode: text(row.data, 'billingCode', 'kodeBilling') } }
  async getPendingStatuses(companyId: string) { const raw = unwrap(await this.request('status', { idPerusahaan: companyId })); if (!Array.isArray(raw)) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); return Promise.all(raw.map((row) => { const parsed = recordSchema.safeParse(row); if (!parsed.success) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); const submission = text(parsed.data, 'submissionNumber', 'nomorAju', 'nomor_aju'); if (!submission) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); return this.getStatusBySubmissionNumber(submission) })) }
  async getDocumentDetail(input: { documentType: '23'; submissionNumber: string; customsOfficeCode: string }) { return this.request(`document/detail/${input.documentType}/${encodeURIComponent(input.submissionNumber)}/${encodeURIComponent(input.customsOfficeCode)}`) }
  downloadResponse(path: string) { return this.request('download-respon', { path: relativeDownloadPath(path) }, true) }
  downloadBilling(billingCode: string) { return this.request('respon/billing', { kodeBilling: billingCode }, true) }
  downloadForm(input: { kind: 'final'; submissionNumber: string }) { return this.request('respon/cetak-formulir/final', { nomorAju: input.submissionNumber }, true) }
  async locations(kind: CeisaLocationReference['kind'], path: string) { const raw = unwrap(await this.request(path)); if (!Array.isArray(raw)) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); return raw.map((item) => { const row = recordSchema.safeParse(item); if (!row.success) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); const code = text(row.data, 'code', 'kode', 'kodePelabuhan', 'kode_pelabuhan'); const name = text(row.data, 'name', 'nama', 'namaPelabuhan', 'nama_pelabuhan'); if (!code || !name) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); return { kind, code, name, source: 'CEISA' as const, fetchedAt: new Date().toISOString() } }) }
  searchForeignPorts(query: string) { return this.locations('FOREIGN_PORT', `referensi/pelabuhan-luar-negeri/${encodeURIComponent(query)}`) }
  listDomesticPorts(code: string) { return this.locations('DOMESTIC_PORT', `referensi/pelabuhan-dalam-negeri/${encodeURIComponent(code)}`) }
  listTpsWarehouses(code: string) { return this.locations('TPS_WAREHOUSE', `referensi/tps-gudang/${encodeURIComponent(code)}`) }
  async getExchangeRate(currencyCode: string): Promise<CeisaExchangeRateObservation> { const row = recordSchema.safeParse(unwrap(await this.request(`kurs/${encodeURIComponent(currencyCode)}`))); if (!row.success) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); const rate = number(row.data, 'rate', 'nilai', 'ndpbm'); const effectiveDate = text(row.data, 'effectiveDate', 'tanggalBerlaku', 'tanggal_berlaku'); if (rate === undefined || !effectiveDate) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); return { currencyCode, rate, effectiveDate, fetchedAt: new Date().toISOString() } }
  async getTariff(input: { hsCode: string; effectiveDate: string }): Promise<CeisaTariffObservation> { const tariff = recordSchema.safeParse(unwrap(await this.request('tarif-hs', { kodeHs: input.hsCode, tanggal: input.effectiveDate }))); if (!tariff.success) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); return { hsCode: input.hsCode, effectiveDate: input.effectiveDate, tariff: tariff.data, fetchedAt: new Date().toISOString() } }
  async getManifestBc11(input: { hostDocumentNumber: string; hostDocumentDate: string; customsOfficeCode: string; importerName: string }): Promise<CeisaManifestEntry[]> { const raw = unwrap(await this.request('manifes-bc11', { nomorDokumenHost: input.hostDocumentNumber, tanggalDokumenHost: input.hostDocumentDate, kodeKantor: input.customsOfficeCode, namaImportir: input.importerName })); if (!Array.isArray(raw)) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); return raw.map((item) => { const row = recordSchema.safeParse(item); if (!row.success) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); const documentNumber = text(row.data, 'documentNumber', 'nomorBc11', 'nomor_bc11'); const documentDate = text(row.data, 'documentDate', 'tanggalBc11', 'tanggal_bc11'); if (!documentNumber || !documentDate) throw new CeisaError('CEISA_CONTRACT_MISMATCH'); return { documentNumber, documentDate, position: text(row.data, 'position', 'posBc11', 'pos_bc11'), subposition: text(row.data, 'subposition', 'subposBc11', 'subpos_bc11'), portCode: text(row.data, 'portCode', 'kodePelabuhan'), warehouseCode: text(row.data, 'warehouseCode', 'kodeGudang'), transportCode: text(row.data, 'transportCode', 'kodePengangkut'), fetchedAt: new Date().toISOString() } }) }
}
