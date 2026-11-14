import assert from 'node:assert/strict'

import { buildExhibitorGroups } from './exhibitor-view'
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
const groups = buildExhibitorGroups(mixed, 'hall')
assert.deepEqual(
  groups.map((group) => group.label),
  ['B2', 'B10', null],
)
assert.equal(groups[0].rows.length, 2)
assert.equal(groups[2].key, '')
assert.equal(groups[2].rows.length, 2)

// Exhibitor sama di dua job: dua baris berurutan, satu exhibitor, total dijumlahkan.
const shared = buildExhibitorGroups(
  [
    job({ ciplLines: [line('e1', 'Alpha', 'C1', 'A1', 3)] }),
    job({ ciplLines: [line('e1', 'Alpha', 'C1', 'A1', 4)] }),
  ],
  'hall',
)
assert.equal(shared.length, 1)
assert.equal(shared[0].rows.length, 2)
assert.equal(shared[0].exhibitorCount, 1)
assert.equal(shared[0].totals.totalCount, 7)

// Job batal tidak menghasilkan baris maupun grup.
const cancelled = buildExhibitorGroups(
  [
    job({ status: 'CANCELLED', ciplLines: [line('e1', 'Alpha', 'Z9', null, 9)] }),
    job({ ciplLines: [line('e2', 'Beta', 'A1', null, 1)] }),
  ],
  'hall',
)
assert.deepEqual(
  cancelled.map((group) => group.label),
  ['A1'],
)

// Agent hanya untuk pihak berjenis AGENT.
const agents = buildExhibitorGroups(
  [
    job({ party: { kind: 'AGENT', id: 'a', name: 'PT Agen' }, ciplLines: [line('e1', 'Alpha', 'A1', 'A1', 1)] }),
    job({ party: { kind: 'EXHIBITOR', id: 'x', name: 'Alpha' }, ciplLines: [line('e2', 'Beta', 'A1', 'A2', 1)] }),
    job({ party: null, ciplLines: [line('e3', 'Gamma', 'A1', 'A3', 1)] }),
  ],
  'hall',
)
assert.deepEqual(
  agents[0].rows.map((row) => row.agent),
  ['PT Agen', null, null],
)

// Urutan baris: booth natural, booth kosong terakhir.
const ordered = buildExhibitorGroups(
  [
    job({
      ciplLines: [
        line('e1', 'Alpha', 'A1', null, 1),
        line('e2', 'Beta', 'A1', 'A10', 1),
        line('e3', 'Gamma', 'A1', 'A2', 1),
      ],
    }),
  ],
  'hall',
)
assert.deepEqual(
  ordered[0].rows.map((row) => row.booth),
  ['A2', 'A10', null],
)

// Nomor job: trim, fallback jobLabel.
const numbers = buildExhibitorGroups(
  [
    job({ jobNumber: ' S.01/X ', ciplLines: [line('e1', 'Alpha', 'A1', 'A1', 1)] }),
    job({ jobNumber: null, manifestPrefix: 'S', ciplLines: [line('e2', 'Beta', 'A1', 'A2', 1)] }),
  ],
  'hall',
)
assert.deepEqual(
  numbers[0].rows.map((row) => row.jobNo),
  ['S.01/X', 'S.-'],
)

// Per agent: satu grup per id agent urut nama; pihak exhibitor/kosong masuk grup tanpa agent
// (terakhir); job batal dilewati.
const easygo = { kind: 'AGENT', id: 'a1', name: 'Easygo' } as const
const byAgent = buildExhibitorGroups(
  [
    job({ party: { kind: 'AGENT', id: 'a2', name: 'Zeta Cargo' }, ciplLines: [line('e1', 'Alpha', 'B2', 'A1', 1)] }),
    job({ party: { kind: 'EXHIBITOR', id: 'e2', name: 'Beta' }, ciplLines: [line('e2', 'Beta', 'A1', 'A2', 2)] }),
    job({ party: easygo, ciplLines: [line('e3', 'Gamma', 'B10', 'A1', 3), line('e4', 'Delta', null, 'A1', 4)] }),
    job({ party: easygo, ciplLines: [line('e5', 'Epsilon', 'B2', 'A9', 5), line('e3', 'Gamma', 'B10', 'A1', 6)] }),
    job({ party: null, ciplLines: [line('e6', 'Eta', 'A1', 'A1', 7)] }),
    job({
      status: 'CANCELLED',
      party: { kind: 'AGENT', id: 'a3', name: 'Batal' },
      ciplLines: [line('e7', 'Theta', 'A1', 'A1', 8)],
    }),
  ],
  'agent',
)
assert.deepEqual(
  byAgent.map((group) => [group.key, group.label]),
  [
    ['a1', 'Easygo'],
    ['a2', 'Zeta Cargo'],
    ['', null],
  ],
)
// Baris lintas job satu agent: urut hall natural, hall kosong terakhir; total dijumlahkan.
assert.deepEqual(
  byAgent[0].rows.map((row) => row.hall),
  ['B2', 'B10', 'B10', null],
)
assert.equal(byAgent[0].exhibitorCount, 3)
assert.equal(byAgent[0].totals.totalCount, 18)
assert.equal(byAgent[2].rows.length, 2)

console.log('exhibitor-view passed')
