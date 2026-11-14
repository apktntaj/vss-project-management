import assert from 'node:assert/strict'

import {
  emptyJobTableFilters,
  filterJobs,
  isEventActive,
  jobAgentOptions,
  nextJobSort,
  sortJobsForTable,
  type JobListEvent,
} from './job-list'
import type { Job } from '@/domain/job/types'

const events = new Map<string, JobListEvent>([
  ['old', { id: 'old', name: 'Expo 2025', venueName: null, startsOn: '2025-05-01', endsOn: '2025-05-03' }],
  [
    'new',
    { id: 'new', name: 'Krista Interfood 2026', venueName: null, startsOn: '2026-11-04', endsOn: '2026-11-07' },
  ],
])

let counter = 0
const job = (overrides: Partial<Job>): Job =>
  ({
    id: `job-${++counter}`,
    eventId: 'new',
    kind: 'INTERNATIONAL',
    internationalJenis: 'TPPB_BC_23',
    transportMode: 'SEA',
    status: 'DRAFT',
    manifestPrefix: 'S',
    manifestSeq: null,
    jobNumber: null,
    party: null,
    transportDocumentNumber: null,
    commercialInvoiceNumber: null,
    invoice: { number: null, amount: null, currency: null, status: 'NOT_READY', sentAt: null, paidAt: null },
    ciplLines: [],
    createdAt: `2026-11-01T00:00:0${counter}Z`,
    ...overrides,
  }) as Job

const s2 = job({ manifestSeq: 2, jobNumber: 'S.02/X' })
const a1 = job({ manifestPrefix: 'A', transportMode: 'AIR', manifestSeq: 1, jobNumber: 'A.01/Y' })
const s1 = job({ manifestSeq: 1, jobNumber: 'S.01/Z', transportDocumentNumber: 'HLCU123' })
const sNone = job({})
const loc = job({ kind: 'LOCAL', internationalJenis: null, manifestPrefix: 'L', manifestSeq: 1, status: 'IN_PROGRESS' })
const oldJob = job({ eventId: 'old', manifestSeq: 1 })

// Urutan meniru manifest: event terbaru dulu, lalu S → A → … → L, lalu urutan, tanpa urutan di akhir.
assert.deepEqual(
  sortJobsForTable([oldJob, loc, sNone, a1, s2, s1], events).map((item) => item.id),
  [s1.id, s2.id, sNone.id, a1.id, loc.id, oldJob.id],
)

const today = new Date('2026-11-02T10:00:00Z')
assert.equal(isEventActive(events.get('old'), today), false)
assert.equal(isEventActive(events.get('new'), today), true)
const all = [oldJob, loc, sNone, a1, s2, s1]
// Bawaan: hanya event aktif.
assert.equal(filterJobs(all, emptyJobTableFilters, events, today).includes(oldJob), false)
// Pencarian nomor B/L, filter jenis & jalur & status.
assert.deepEqual(filterJobs(all, { ...emptyJobTableFilters, search: 'hlcu' }, events, today), [s1])
assert.deepEqual(filterJobs(all, { ...emptyJobTableFilters, jenis: 'LOCAL' }, events, today), [loc])
assert.deepEqual(filterJobs(all, { ...emptyJobTableFilters, transportMode: 'AIR' }, events, today), [a1])
assert.deepEqual(filterJobs(all, { ...emptyJobTableFilters, status: 'IN_PROGRESS' }, events, today), [loc])
assert.deepEqual(filterJobs(all, { ...emptyJobTableFilters, activeOnly: false, eventId: 'old' }, events, today), [oldJob])

// Agent: pilihan filter hanya agent yang memegang job (urut nama, tanpa duplikat); filter per id.
const zeta = { kind: 'AGENT', id: 'ag-z', name: 'Zeta Cargo' } as const
const easygo = { kind: 'AGENT', id: 'ag-e', name: 'easygo' } as const
const z10 = job({ manifestSeq: 10, jobNumber: 'S.10/X', party: zeta, status: 'COMPLETED' })
const e3 = job({ manifestSeq: 3, jobNumber: 'S.03/X', party: easygo, status: 'IN_PROGRESS' })
const e4 = job({ manifestSeq: 4, jobNumber: 'S.04/X', party: easygo })
const direct = job({ manifestSeq: 5, jobNumber: 'S.05/X', party: { kind: 'EXHIBITOR', id: 'ag-e', name: 'Alpha' } })
const parties = [z10, direct, e4, e3, sNone]
assert.deepEqual(jobAgentOptions(parties), [
  { id: 'ag-e', name: 'easygo' },
  { id: 'ag-z', name: 'Zeta Cargo' },
])
assert.deepEqual(filterJobs(parties, { ...emptyJobTableFilters, agentId: 'ag-e' }, events, today), [e4, e3])

// Urut per kolom: nilai kosong selalu di akhir (naik maupun turun), nilai sama mengikuti urutan bawaan.
const ids = (list: Job[]) => list.map((item) => item.id)
assert.deepEqual(
  ids(sortJobsForTable(parties, events, { key: 'agent', direction: 'asc' })),
  ids([e3, e4, z10, direct, sNone]),
)
assert.deepEqual(
  ids(sortJobsForTable(parties, events, { key: 'agent', direction: 'desc' })),
  ids([z10, e3, e4, direct, sNone]),
)
// No Job dibandingkan natural (S.10 setelah S.05); status mengikuti urutan tahapan, bukan abjad.
assert.deepEqual(
  ids(sortJobsForTable(parties, events, { key: 'jobNumber', direction: 'desc' })),
  ids([z10, direct, e4, e3, sNone]),
)
assert.deepEqual(
  ids(sortJobsForTable(parties, events, { key: 'status', direction: 'desc' })),
  ids([z10, e3, e4, direct, sNone]),
)

// Klik header berulang: naik → turun → urutan bawaan; kolom lain mulai lagi dari naik.
const asc = nextJobSort(null, 'agent')
assert.deepEqual(asc, { key: 'agent', direction: 'asc' })
const desc = nextJobSort(asc, 'agent')
assert.deepEqual(desc, { key: 'agent', direction: 'desc' })
assert.equal(nextJobSort(desc, 'agent'), null)
assert.deepEqual(nextJobSort(desc, 'status'), { key: 'status', direction: 'asc' })

console.log('job list table passed')
