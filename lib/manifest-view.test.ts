import assert from 'node:assert/strict'

import { buildManifestView } from './manifest-view'
import type { LocalExhibitor, LocalJob } from './data-client'

const agentId = 'agent-1'
const eventId = 'event-1'

const job = {
  id: 'job-1',
  jobNumber: 'VSS-0001',
  agent: 'SHENZHEN BOBON LOGISTICS CO.,LTD',
  agentId,
  eventId,
  kind: 'INTERNATIONAL' as const,
  internationalJenis: 'PERMANENT_IMPORT' as const,
  inward: {
    transportDocument: { kind: 'BL', number: 'SHFPSJKT26026454' },
    loadConfiguration: { kind: 'LCL' },
    milestones: [{ kind: 'SKEP', date: '2026-09-02', documentNumber: 'S-622/WBC.08/2026' }],
    notes: [],
  },
  kepulangan: null,
} as unknown as LocalJob

const exhibitor = (overrides: Partial<LocalExhibitor>): LocalExhibitor =>
  ({
    id: overrides.id ?? 'exh-1',
    eventId,
    agentId,
    name: 'WUHU CHURUI INTELLIGENT TECHNOLOGY CO.,LTD.',
    kind: 'INTERNATIONAL',
    logistics: null,
    ...overrides,
  }) as LocalExhibitor

const view = buildManifestView(job, [
  exhibitor({ id: 'exh-1', name: 'WUHU CHURUI', logistics: { hall: null, booth: 'C302', koli: { totalCount: 3, bareCaseCount: null, details: [{ label: 'PK 1', dimension: { lengthCm: 120, widthCm: 101, heightCm: 202 }, volumeCbm: 2.45, weightKg: 428 }] }, notes: [] } }),
  // Exhibitor event lain / agent lain tidak ikut blok ini.
  exhibitor({ id: 'exh-2', eventId: 'event-other', agentId, name: 'SALAH EVENT' }),
  exhibitor({ id: 'exh-3', agentId: 'agent-other', name: 'SALAH AGENT' }),
])

assert.equal(view.peserta.length, 1)
assert.equal(view.peserta[0].logistics?.booth, 'C302')
assert.equal(view.totals.totalCount, 3)
assert.equal(view.totals.weightKg, 428)
assert.equal(view.inward?.transportDocument.number, 'SHFPSJKT26026454')
assert.equal(view.agentName, 'SHENZHEN BOBON LOGISTICS CO.,LTD')

// Job LOCAL tanpa agent: peserta kosong, view tetap sah.
const localView = buildManifestView({ ...job, agentId: null, kind: 'LOCAL', inward: null } as LocalJob, [exhibitor({})])
assert.equal(localView.peserta.length, 0)
assert.equal(localView.totals.totalCount, 0)

console.log('manifest view assembler passed')
