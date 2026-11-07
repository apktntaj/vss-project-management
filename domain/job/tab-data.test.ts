import assert from 'node:assert/strict'

import { emptyOperationalDetails } from './operational'
import { hasTabData, tabActionLabel } from './tab-data'
import type { Job } from './types'

const empty = {
  ciplSources: [],
  ciplDocument: null,
  ciplLines: [],
  inward: null,
  kepulangan: null,
  transportDocument: null,
  transportDocumentType: null,
  transportDocumentNumber: null,
  emptyStorage: null,
  reExport: null,
  party: null,
  operational: emptyOperationalDetails(),
  invoice: { number: null, amount: null, currency: null, status: 'NOT_READY', sentAt: null, paidAt: null },
} as unknown as Job
const patch = (value: Partial<Job>) => ({ ...empty, ...value }) as Job

// Job baru tanpa isian: ketiga tab kosong dan tombolnya "Buat".
assert.equal(hasTabData('muatan', empty), false)
assert.equal(hasTabData('transport', empty), false)
assert.equal(hasTabData('billing', empty), false)
assert.equal(tabActionLabel('muatan', empty), 'Buat CIPL')
assert.equal(tabActionLabel('transport', empty), 'Buat Transport')
assert.equal(tabActionLabel('billing', empty), 'Buat Billing')

// Muatan: satu berkas CIPL atau manifest inward sudah cukup — dan label ikut berubah.
assert.equal(hasTabData('muatan', patch({ ciplSources: [{ kind: 'PACKING_LIST', receivedAt: '2026-11-01T00:00:00Z' }] })), true)
const inwardOnly = patch({ inward: {} as Job['inward'] })
assert.equal(hasTabData('muatan', inwardOnly), true)
assert.equal(tabActionLabel('muatan', inwardOnly), 'Edit CIPL')

// Transport: nomor dokumen angkut, satu field leg, atau BC yang diubah dari default.
const withDocument = patch({ transportDocumentNumber: 'MAEU123' })
assert.equal(hasTabData('transport', withDocument), true)
assert.equal(tabActionLabel('transport', withDocument), 'Edit Transport')
assert.equal(
  hasTabData('transport', patch({ operational: { ...empty.operational, outbound: { ...empty.operational.outbound, carrier: 'MSC' } } })),
  true,
)
assert.equal(hasTabData('transport', patch({ reExport: 'Ya' })), true)
const customsStarted = emptyOperationalDetails()
customsStarted.customs.BC_2_3.status = 'PREPARING'
assert.equal(hasTabData('transport', patch({ operational: customsStarted })), true)
// Menandai BC yang secara default tidak diperlukan sebagai diperlukan juga dihitung sebagai isian.
const customsToggled = emptyOperationalDetails()
customsToggled.customs.BC_2_5.applicable = true
assert.equal(hasTabData('transport', patch({ operational: customsToggled })), true)

// Billing: pihak, nomor/nilai tagihan, atau status selain default.
const withParty = patch({ party: { kind: 'AGENT', id: 'a1', name: 'Agent' } })
assert.equal(hasTabData('billing', withParty), true)
assert.equal(tabActionLabel('billing', withParty), 'Edit Billing')
assert.equal(hasTabData('billing', patch({ invoice: { ...empty.invoice, amount: 0 } })), true)
assert.equal(hasTabData('billing', patch({ invoice: { ...empty.invoice, status: 'READY' } })), true)
