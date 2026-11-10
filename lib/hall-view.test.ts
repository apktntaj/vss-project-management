import assert from 'node:assert/strict'

import { buildHallGroups } from './hall-view'
import type { Job, JobCiplLine } from '@/domain/job/types'
import type { OperationalNote } from '@/domain/job/manifest'

let counter = 0
const job = (overrides: Partial<Job>): Job =>
  ({
    id: `job-${++counter}`,
    status: 'IN_PROGRESS',
    manifestPrefix: 'S',
    jobNumber: `S.0${counter}/X`,
    party: null,
    ciplLines: [],
    ...overrides,
  }) as Job

const line = (
  exhibitorId: string | null,
  name: string,
  hall: string | null,
  booth: string | null,
  totalCount: number,
  notes: OperationalNote[] = [],
): JobCiplLine =>
  ({
    id: `line-${++counter}`,
    exhibitorId,
    exhibitor: exhibitorId ? { id: exhibitorId, name, hall, booth } : null,
    nameOnDocument: name,
    koli: { totalCount, bareCaseCount: null, details: [] },
    items: [],
    notes,
  }) as JobCiplLine

// Penggabungan hall beda kapitalisasi, urutan natural, "Tanpa hall" terakhir.
const mixed = [
  job({
    ciplLines: [
      line('e1', 'Alpha', 'B10', 'B-1', 1),
      line('e2', 'Beta', 'B2', 'A1', 2),
      line(null, 'Tak Tertaut', null, null, 3),
    ],
  }),
  job({ ciplLines: [line('e3', 'Gamma', 'b2', 'A2', 4), line('e4', 'Delta', null, null, 5)] }),
]
const groups = buildHallGroups(mixed)
assert.deepEqual(
  groups.map((group) => group.label),
  ['B2', 'B10', null],
)
assert.equal(groups[0].rows.length, 2)
assert.equal(groups[2].key, '')
assert.equal(groups[2].rows.length, 2)

// Exhibitor sama di dua job: dua baris berurutan, satu exhibitor, total dijumlahkan.
const shared = buildHallGroups(
  [
    job({ ciplLines: [line('e1', 'Alpha', 'C1', 'A1', 3)] }),
    job({ ciplLines: [line('e1', 'Alpha', 'C1', 'A1', 4)] }),
  ],
)
assert.equal(shared.length, 1)
assert.equal(shared[0].rows.length, 2)
assert.equal(shared[0].exhibitorCount, 1)
assert.equal(shared[0].totals.totalCount, 7)

// Job batal tidak menghasilkan baris maupun grup.
const cancelled = buildHallGroups(
  [
    job({ status: 'CANCELLED', ciplLines: [line('e1', 'Alpha', 'Z9', null, 9)] }),
    job({ ciplLines: [line('e2', 'Beta', 'A1', null, 1)] }),
  ],
)
assert.deepEqual(
  cancelled.map((group) => group.label),
  ['A1'],
)

// Agent hanya untuk pihak berjenis AGENT.
const agents = buildHallGroups(
  [
    job({ party: { kind: 'AGENT', id: 'a', name: 'PT Agen' }, ciplLines: [line('e1', 'Alpha', 'A1', 'A1', 1)] }),
    job({ party: { kind: 'EXHIBITOR', id: 'x', name: 'Alpha' }, ciplLines: [line('e2', 'Beta', 'A1', 'A2', 1)] }),
    job({ party: null, ciplLines: [line('e3', 'Gamma', 'A1', 'A3', 1)] }),
  ],
)
assert.deepEqual(
  agents[0].rows.map((row) => row.agent),
  ['PT Agen', null, null],
)

// Urutan baris: booth natural, booth kosong terakhir.
const ordered = buildHallGroups(
  [
    job({
      ciplLines: [
        line('e1', 'Alpha', 'A1', null, 1),
        line('e2', 'Beta', 'A1', 'A10', 1),
        line('e3', 'Gamma', 'A1', 'A2', 1),
      ],
    }),
  ],
)
assert.deepEqual(
  ordered[0].rows.map((row) => row.booth),
  ['A2', 'A10', null],
)

// Nomor job: trim, fallback jobLabel.
const numbers = buildHallGroups(
  [
    job({ jobNumber: ' S.01/X ', ciplLines: [line('e1', 'Alpha', 'A1', 'A1', 1)] }),
    job({ jobNumber: null, manifestPrefix: 'S', ciplLines: [line('e2', 'Beta', 'A1', 'A2', 1)] }),
  ],
)
assert.deepEqual(
  numbers[0].rows.map((row) => row.jobNo),
  ['S.01/X', 'S.-'],
)

console.log('hall-view passed')
