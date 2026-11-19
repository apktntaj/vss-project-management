import assert from 'node:assert/strict'

import { buildJobReadiness } from './job-readiness'
import type { Job } from '@/domain/job/types'

// Job minimal draft INTERNATIONAL tahap INBOUND: operational kosong dinormalisasi ke default
// (hanya BC 2.3 applicable; CIPL MISSING; tagihan NOT_READY).
const draft = {
  id: 'job-1',
  version: 1,
  eventId: 'event-1',
  kind: 'INTERNATIONAL',
  jobNumber: null,
  manifestPrefix: 'S',
  stage: 'INBOUND',
  sourceJobId: null,
  transportDocumentType: null,
  transportDocumentNumber: null,
  invoice: { number: null, amount: null, currency: null, status: 'NOT_READY', sentAt: null, paidAt: null },
  operational: {},
  ciplSources: [],
  ciplDocument: null,
  ciplLines: [],
} as unknown as Job

const byKey = (job: Job) =>
  Object.fromEntries(buildJobReadiness(job).steps.map((step) => [step.key, step]))

// (1) Job kosong: semua langkah todo, belum ada yang selesai.
const empty = byKey(draft)
assert.equal(empty.number.state, 'todo')
assert.equal(empty.number.detail, 'S.-')
assert.equal(empty.transport.state, 'todo')
assert.equal(empty.transport.detail, 'Belum ada')
assert.equal(empty.cipl.state, 'todo')
assert.equal(empty.cipl.detail, 'Belum ada')
assert.equal(empty.customs.state, 'todo')
assert.equal(empty.customs.detail, '0/1 selesai')
assert.equal(empty.invoice.state, 'todo')
assert.equal(empty.invoice.detail, 'Belum siap')
assert.equal(buildJobReadiness(draft).doneCount, 0)

// (2) Job Local tidak memerlukan dokumen BC.
const localCustoms = byKey({ ...draft, kind: 'LOCAL' } as Job).customs
assert.equal(localCustoms.state, 'done')
assert.equal(localCustoms.detail, 'Tidak diperlukan')

// (3) Job lengkap: semua langkah done.
const completeJob = {
  ...draft,
  jobNumber: 'S.01/234YFN',
  transportDocumentType: 'BL',
  transportDocumentNumber: 'SHFPSJKT26026454',
  invoice: { ...draft.invoice, status: 'PAID' },
  ciplSources: [{ kind: 'CIPL', receivedAt: '2026-11-01T00:00:00Z' }],
  operational: {
    customs: {
      BC_2_3: { applicable: true, status: 'COMPLETED', ajuNumber: null, registrationNumber: null, registrationDate: null, warehouseName: null },
      BC_3_0: { applicable: true, status: 'COMPLETED', ajuNumber: null, registrationNumber: null, registrationDate: null, warehouseName: null },
    },
  },
} as unknown as Job
const complete = buildJobReadiness(completeJob)
assert.equal(complete.doneCount, 5)
assert.ok(complete.steps.every((step) => step.state === 'done'))
assert.equal(byKey(completeJob).transport.detail, 'BL SHFPSJKT26026454')

// (4) Setiap langkah menunjuk tab area kerja yang benar.
assert.deepEqual(
  Object.fromEntries(complete.steps.map((step) => [step.key, step.tab])),
  {
    number: 'header',
    transport: 'transport',
    cipl: 'muatan',
    customs: 'pabean',
    invoice: 'billing',
  },
)

// Transisi tengah: sebagian BC selesai → doing; CIPL diterima & tagihan terkirim → doing.
const partial = byKey({
  ...draft,
  ciplSources: [{ kind: 'COMMERCIAL_INVOICE', receivedAt: '2026-11-01T00:00:00Z' }],
  operational: {
    customs: {
      BC_2_3: { applicable: true, status: 'COMPLETED', ajuNumber: null, registrationNumber: null, registrationDate: null, warehouseName: null },
      BC_3_0: { applicable: true, status: 'NOT_STARTED', ajuNumber: null, registrationNumber: null, registrationDate: null, warehouseName: null },
    },
  },
  invoice: { ...draft.invoice, status: 'SENT' },
} as unknown as Job)
const partialCustoms = partial.customs
assert.equal(partialCustoms.state, 'doing')
assert.equal(partialCustoms.detail, '1/2 selesai')
assert.equal(partial.cipl.state, 'doing')
assert.equal(partial.cipl.detail, 'PL belum ada')
assert.equal(partial.invoice.state, 'doing')
assert.equal(partial.invoice.detail, 'Terkirim')

// INTERNATIONAL tanpa BC applicable sama sekali → tidak diperlukan (done).
const noCustoms = byKey({
  ...draft,
  operational: {
    customs: {
      BC_2_3: { applicable: false, status: 'NOT_STARTED', ajuNumber: null, registrationNumber: null, registrationDate: null, warehouseName: null },
      BC_3_0: { applicable: false, status: 'NOT_STARTED', ajuNumber: null, registrationNumber: null, registrationDate: null, warehouseName: null },
    },
  },
} as unknown as Job).customs
assert.equal(noCustoms.state, 'done')
assert.equal(noCustoms.detail, 'Tidak diperlukan')

// Job turunan (BC 3.0): CIPL & angkut ikut job masuk, dokumen BC-nya sendiri yang dihitung.
const derived = byKey({
  ...draft,
  stage: 'RE_EXPORT',
  sourceJobId: 'job-0',
} as unknown as Job)
assert.equal(derived.cipl.detail, 'Ikut job masuk')
assert.equal(derived.cipl.state, 'done')
assert.equal(derived.transport.detail, 'Tidak diperlukan')
assert.equal(derived.transport.state, 'done')
assert.equal(derived.customs.detail, '0/1 selesai')
// No Job job turunan berawalan "EX" tanpa akhiran tahap (lencana tahap ada di header halaman).
assert.equal(derived.number.detail, 'EXS.-')

// Pabean 'doing' bila ada dokumen applicable yang bergerak (selain NOT_STARTED), walau belum COMPLETED.
const bcDoc = (status: string, applicable = true) => ({
  applicable,
  status,
  ajuNumber: null,
  registrationNumber: null,
  registrationDate: null,
  warehouseName: null,
})
const customsOf = (bc23: string, bc30: string, bc30Applicable = true) =>
  byKey({
    ...draft,
    operational: { customs: { BC_2_3: bcDoc(bc23), BC_3_0: bcDoc(bc30, bc30Applicable) } },
  } as unknown as Job).customs
const released = customsOf('RELEASED', 'NOT_STARTED', false)
assert.equal(released.state, 'doing')
assert.equal(released.detail, '0/1 selesai')
assert.equal(customsOf('PREPARING', 'NOT_STARTED', false).state, 'doing')
assert.equal(customsOf('NOT_STARTED', 'NOT_STARTED', false).state, 'todo')
// Dokumen non-applicable yang sudah bergerak tidak membuat langkah 'doing'.
assert.equal(customsOf('NOT_STARTED', 'RELEASED', false).state, 'todo')
assert.equal(customsOf('COMPLETED', 'COMPLETED', false).state, 'done')

// Road Shipment: tanpa B/L-AWB dan tanpa dokumen pabean → keduanya done, 'Tidak diperlukan'.
const road = byKey({
  ...draft,
  kind: 'INTERNATIONAL',
  internationalJenis: 'ROAD_SHIPMENT',
  stage: null,
} as unknown as Job)
assert.equal(road.transport.state, 'done')
assert.equal(road.transport.detail, 'Tidak diperlukan')
assert.equal(road.customs.state, 'done')
assert.equal(road.customs.detail, 'Tidak diperlukan')
// Jenis lain tetap menuntut B/L-AWB.
assert.equal(
  byKey({ ...draft, internationalJenis: 'TPPB_BC_23' } as unknown as Job).transport.state,
  'todo',
)

console.log('job readiness passed')
