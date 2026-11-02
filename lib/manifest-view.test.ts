import assert from 'node:assert/strict'

import { buildManifestView } from './manifest-view'
import type { Job, JobCiplLine } from '@/domain/job/types'

const koli = (totalCount: number, weightKg: number) => ({
  totalCount,
  bareCaseCount: null,
  details: [{ label: 'PK 1', dimension: { lengthCm: 120, widthCm: 101, heightCm: 202 }, volumeCbm: 2.45, weightKg }],
})

const line = (overrides: Partial<JobCiplLine>): JobCiplLine => ({
  id: 'line-1',
  exhibitorId: null,
  exhibitor: null,
  nameOnDocument: 'WUHU CHURUI INTELLIGENT TECHNOLOGY CO.,LTD.',
  koli: koli(3, 428),
  items: [],
  notes: [],
  ...overrides,
})

const job = {
  id: 'job-1',
  vssNumber: 'VSS-00001',
  jobNumber: 'S.01/234YFN',
  eventId: 'event-1',
  kind: 'INTERNATIONAL',
  internationalJenis: 'PERMANENT_IMPORT',
  party: { kind: 'AGENT', id: 'agent-1', name: 'SHENZHEN BOBON LOGISTICS CO.,LTD' },
  transportDocumentType: 'BL',
  transportDocumentNumber: 'SHFPSJKT26026454',
  inward: {
    loadConfiguration: { kind: 'LCL' },
    milestones: [{ kind: 'SKEP', date: '2026-09-02', documentNumber: 'S-622/WBC.08/2026' }],
    notes: [],
  },
  kepulangan: null,
  ciplLines: [
    // Tertaut: nama & hall/booth dari exhibitor event, koli dari baris CIPL.
    line({
      id: 'line-1',
      exhibitorId: 'exh-1',
      exhibitor: { id: 'exh-1', name: 'WUHU CHURUI', hall: 'C3', booth: 'C302' },
    }),
    // Belum tertaut: tetap tampil dengan nama seperti tertulis di CIPL.
    line({ id: 'line-2', nameOnDocument: 'SHANDONG KANGBEITE', koli: koli(2, 1200) }),
  ],
} as unknown as Job

const view = buildManifestView(job)
assert.equal(view.jobNumber, 'S.01/234YFN')
assert.equal(view.partyName, 'SHENZHEN BOBON LOGISTICS CO.,LTD')
assert.deepEqual(view.transportDocument, { type: 'BL', number: 'SHFPSJKT26026454' })
assert.deepEqual(
  view.peserta.map((item) => [item.name, item.linked, item.logistics.booth]),
  [
    ['WUHU CHURUI', true, 'C302'],
    ['SHANDONG KANGBEITE', false, null],
  ],
)
assert.equal(view.totals.totalCount, 5)
assert.equal(view.totals.weightKg, 1628)

// Tanpa No Job, nomor internal VSS yang tampil; tanpa pihak & tanpa baris, view tetap sah.
const bare = buildManifestView({ ...job, jobNumber: null, party: null, ciplLines: [], transportDocumentNumber: null } as Job)
assert.equal(bare.jobNumber, 'VSS-00001')
assert.equal(bare.partyName, 'Pihak belum ditetapkan')
assert.equal(bare.transportDocument, null)
assert.equal(bare.totals.totalCount, 0)

console.log('manifest view assembler passed')
