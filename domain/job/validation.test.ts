import assert from 'node:assert/strict'

import { emptyOperationalDetails } from './operational'
import {
  jobCiplPutSchema,
  jobCreateSchema,
  jobDetailsPatchSchema,
  jobExtractionSchema,
  jobInvoiceSchema,
} from './validation'

const eventId = '7f0c1a52-4c5b-4d4c-9d6e-2a8f1b3c4d5e'
const exhibitorId = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d'
const ok = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success

// Jenis vs jalur Local/International.
assert.equal(ok(jobCreateSchema, { eventId, kind: 'INTERNATIONAL' }), false)
assert.equal(ok(jobCreateSchema, { eventId, kind: 'LOCAL', internationalJenis: 'ATA_CARNET' }), false)
// Pihak: agent ATAU exhibitor.
assert.equal(ok(jobCreateSchema, { eventId, kind: 'INTERNATIONAL', internationalJenis: 'TPPB_BC_23', agentId: 'agent-1', exhibitorId }), false)
// Local selalu exhibitor; Road Shipment boleh agent (contoh manifest klien: "AGENT : EASYGO").
assert.equal(ok(jobCreateSchema, { eventId, kind: 'LOCAL', agentId: 'agent-1' }), false)
assert.equal(ok(jobCreateSchema, { eventId, kind: 'INTERNATIONAL', internationalJenis: 'ROAD_SHIPMENT', agentId: 'agent-1' }), true)
assert.equal(ok(jobCreateSchema, { eventId, kind: 'INTERNATIONAL', internationalJenis: 'ROAD_SHIPMENT', transportMode: 'SEA' }), false)
assert.equal(ok(jobCreateSchema, { eventId, kind: 'LOCAL', exhibitorId }), true)
// Agent boleh punya banyak job — tidak ada aturan unik di skema.
const created = jobCreateSchema.parse({ eventId, kind: 'INTERNATIONAL', internationalJenis: 'TPPB_BC_23', transportMode: 'SEA', agentId: 'agent-1', exhibitorId: '' })
assert.equal(created.exhibitorId, null)
// Field tak dikenal ditolak (mis. salinan data aggregate lain).
assert.equal(ok(jobCreateSchema, { eventId, kind: 'LOCAL', exhibitor: { name: 'X' } }), false)

// Setiap tulis wajib membawa versi; field model lama ditolak.
assert.equal(ok(jobDetailsPatchSchema, { notes: 'x' }), false)
assert.equal(ok(jobDetailsPatchSchema, { version: 1, billTo: 'X' }), false)
assert.equal(ok(jobDetailsPatchSchema, { version: 1, manifestSeq: 0 }), false)
assert.equal(ok(jobDetailsPatchSchema, { version: 1, party: { agentId: 'a', exhibitorId } }), false)
const patch = jobDetailsPatchSchema.parse({ version: 3, notes: '  ', manifestSeq: 2, operational: emptyOperationalDetails() })
assert.equal(patch.notes, null)
assert.equal(patch.manifestSeq, 2)

// Tagihan.
const invoice = { number: null, amount: null, currency: null, status: 'NOT_READY', sentAt: null, paidAt: null }
assert.equal(ok(jobInvoiceSchema, invoice), true)
assert.equal(ok(jobInvoiceSchema, { ...invoice, status: 'SENT' }), false)
assert.equal(ok(jobInvoiceSchema, { ...invoice, status: 'PAID', number: 'INV-1' }), false)
assert.equal(ok(jobInvoiceSchema, { ...invoice, status: 'PAID', number: 'INV-1', paidAt: '2026-11-02T10:00:00+07:00' }), true)
assert.equal(jobInvoiceSchema.parse({ ...invoice, currency: 'usd' }).currency, 'USD')
assert.equal(ok(jobInvoiceSchema, { ...invoice, currency: 'RUPIAH' }), false)

// Ekstraksi tanpa dokumen ditolak.
assert.equal(ok(jobExtractionSchema, { version: 1 }), false)

// Baris CIPL: satu exhibitor sekali per job; baris belum tertaut boleh berulang.
const koli = { totalCount: 1, bareCaseCount: null, details: [] }
const line = (id: string | null, name: string) => ({ exhibitorId: id, nameOnDocument: name, koli })
assert.equal(ok(jobCiplPutSchema, { version: 1, ciplDocument: null, lines: [line(exhibitorId, 'A'), line(exhibitorId, 'A2')] }), false)
assert.equal(ok(jobCiplPutSchema, { version: 1, ciplDocument: null, lines: [line(null, 'A'), line(null, 'B'), line(exhibitorId, 'C')] }), true)
assert.equal(ok(jobCiplPutSchema, { version: 1, ciplDocument: null, lines: [line(null, '  ')] }), false)

console.log('job validation passed')
