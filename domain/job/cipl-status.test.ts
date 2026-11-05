import assert from 'node:assert/strict'

import { ciplStatusText, deriveCiplStatus } from './cipl-status'
import type { Job } from './types'

const base = {
  ciplSources: [],
  ciplDocument: null,
  ciplLines: [],
  operational: {},
} as unknown as Job

const derive = (patch: Partial<Job>) => deriveCiplStatus({ ...base, ...patch })
const source = (kind: Job['ciplSources'][number]['kind'], receivedAt: string) => ({ kind, receivedAt })

// Tanpa berkas maupun data → menunggu.
const none = derive({})
assert.equal(none.status, 'MISSING')
assert.equal(none.receivedAt, null)
assert.equal(ciplStatusText(none), 'Menunggu CIPL')

// CI saja (berkas) → sebagian, packing list kurang.
const invoiceOnly = derive({ ciplSources: [source('COMMERCIAL_INVOICE', '2026-11-01T00:00:00Z')] })
assert.equal(invoiceOnly.status, 'PARTIAL')
assert.equal(ciplStatusText(invoiceOnly), 'Sebagian · Packing list belum ada')

// PL saja → sebagian, commercial invoice kurang.
const packingOnly = derive({ ciplSources: [source('PACKING_LIST', '2026-11-01T00:00:00Z')] })
assert.equal(packingOnly.status, 'PARTIAL')
assert.equal(ciplStatusText(packingOnly), 'Sebagian · Commercial invoice belum ada')

// CI + PL terpisah → diterima; tanggal = lampiran terbaru.
const both = derive({
  ciplSources: [source('COMMERCIAL_INVOICE', '2026-11-01T00:00:00Z'), source('PACKING_LIST', '2026-11-03T00:00:00Z')],
})
assert.equal(both.status, 'RECEIVED')
assert.equal(both.receivedAt, '2026-11-03T00:00:00Z')

// Satu berkas gabungan menutup kedua peran.
assert.equal(derive({ ciplSources: [source('CIPL', '2026-11-01T00:00:00Z')] }).status, 'RECEIVED')

// Data tanpa berkas juga menutup peran: invoice hasil ekstraksi, baris CIPL hasil scan.
const dataOnlyInvoice = derive({ operational: { invoice: {} } } as unknown as Partial<Job>)
assert.equal(dataOnlyInvoice.status, 'PARTIAL')
assert.equal(dataOnlyInvoice.hasInvoice, true)
assert.equal(dataOnlyInvoice.receivedAt, null)
const withLines = derive({ ciplLines: [{}] } as unknown as Partial<Job>)
assert.equal(withLines.hasPackingList, true)
assert.equal(withLines.hasInvoice, false)
assert.equal(
  derive({ ciplDocument: {}, ciplLines: [{}] } as unknown as Partial<Job>).status,
  'RECEIVED',
)

console.log('cipl status passed')
