import assert from 'node:assert/strict'

import { emptyJobTableFilters, filterJobs, isEventActive, sortJobsForTable, type JobListEvent } from './job-list'
import type { Job } from '@/domain/job/types'

const events = new Map<string, JobListEvent>([
  ['old', { id: 'old', name: 'Expo 2025', startsOn: '2025-05-01', endsOn: '2025-05-03' }],
  ['new', { id: 'new', name: 'Krista Interfood 2026', startsOn: '2026-11-04', endsOn: '2026-11-07' }],
])

let counter = 0
const job = (overrides: Partial<Job>): Job =>
  ({
    id: `job-${++counter}`,
    vssNumber: `VSS-${String(counter).padStart(5, '0')}`,
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
const loc = job({ kind: 'LOCAL', internationalJenis: null, manifestPrefix: 'LOC', manifestSeq: 1, status: 'IN_PROGRESS' })
const oldJob = job({ eventId: 'old', manifestSeq: 1 })

// Urutan meniru manifest: event terbaru dulu, lalu S → A → … → LOC, lalu urutan, tanpa urutan di akhir.
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

console.log('job list table passed')
