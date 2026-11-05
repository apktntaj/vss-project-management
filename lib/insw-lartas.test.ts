import assert from 'node:assert/strict'

import { lookupHsCode, type LookupConfig } from './insw-lartas'

// Diagnosis "Sumber gagal": pesan harus menyebut penyebab sebenarnya. fetch dimock per URL.
const realFetch = globalThis.fetch
const respond = (status: number, body: unknown = { error: 'x' }) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const mockFetch = (handler: (url: URL) => Response) => {
  globalThis.fetch = (async (input: RequestInfo | URL) => handler(new URL(String(input)))) as typeof fetch
}
const base: LookupConfig = { baseUrl: 'https://api.insw.go.id', timeoutMs: 1000 }

try {
  // (1) Tanpa token + sumber publik 404 → pesan menyebut token belum dikonfigurasi dan HTTP 404.
  mockFetch(() => respond(404))
  const noToken = await lookupHsCode('8471.30.90', base)
  assert.equal(noToken.lookupStatus, 'source-error')
  assert.equal(noToken.lartas.verification, 'unverified')
  assert.match(noToken.error ?? '', /Token INSW belum dikonfigurasi/)
  assert.match(noToken.error ?? '', /HTTP 404/)

  // (2) Token ditolak CMS (401) → pesan menyebut token ditolak.
  mockFetch((url) => respond(url.pathname.startsWith('/api/cms/') ? 401 : 404))
  const rejected = await lookupHsCode('84713090', { ...base, token: 'abc' })
  assert.equal(rejected.lookupStatus, 'source-error')
  assert.match(rejected.error ?? '', /Token INSW ditolak \(HTTP 401\)/)

  // (3) Token valid → hasil CMS terverifikasi, tanpa error.
  mockFetch((url) =>
    url.pathname === '/api/cms/hscode'
      ? respond(200, { data: [{ hsCode: '84713090' }] })
      : respond(200, { data: { informasiTarif: [{ label: 'BM MFN', value: '5' }], regulasiImporBorder: {}, regulasiImporPostborder: {}, regulasiEkspor: {} } }),
  )
  const ok = await lookupHsCode('84713090', { ...base, token: 'abc' })
  assert.equal(ok.lookupStatus, 'found')
  assert.equal(ok.lartas.verification, 'verified')
  assert.equal(ok.tariffs.bm, '5')
  assert.equal(ok.error, null)
} finally {
  globalThis.fetch = realFetch
}
