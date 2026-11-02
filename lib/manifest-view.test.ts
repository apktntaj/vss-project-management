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

// Baris hasil scan CIPL melebur ke peserta master, tidak menumpuk:
//  - baris pertama tertaut lewat exhibitorId (autofill CIPL),
//  - baris kedua tertaut lewat nama ternormalisasi saja (baris lama tanpa id, ejaan beda),
//  - baris ketiga belum dikenal event ini → tetap tampil sebagai peserta hasil scan.
const ciplKoli = (weightKg: number) => ({
  totalCount: 2,
  bareCaseCount: null,
  details: [{ label: 'PKG 1', dimension: null, volumeCbm: null, weightKg }],
})
const merged = buildManifestView(
  {
    ...job,
    manifestExhibitors: [
      { exhibitorId: 'exh-1', name: 'WUHU CHURUI INTELLIGENT TECHNOLOGY CO., LTD.', logistics: { hall: null, booth: 'C302', koli: ciplKoli(428), notes: [] } },
      { name: 'Shandong Kangbeite Food Packaging Machinery Co., Ltd', logistics: { hall: 'C3', booth: 'I328', koli: ciplKoli(1200), notes: [] } },
      { exhibitorId: 'exh-baru', name: 'WENZHOU HUAQIAO PACKING MACHINE FACTORY', logistics: { hall: 'B3', booth: 'G301', koli: ciplKoli(58), notes: [] } },
    ],
  } as unknown as LocalJob,
  [
    exhibitor({ id: 'exh-1', name: 'WUHU CHURUI', logistics: { hall: null, booth: 'C302', koli: { totalCount: 3, bareCaseCount: null, details: [{ label: 'PK 1', dimension: null, volumeCbm: 2.45, weightKg: 428 }] }, notes: [] } }),
    exhibitor({ id: 'exh-2', name: 'SHANDONG KANGBEITE FOOD PACKAGING MACHINERY CO., LTD.' }),
  ],
)
assert.equal(merged.peserta.length, 3, 'dua master + satu baris scan yang belum dikenal')
assert.deepEqual(
  merged.peserta.map((item) => [item.name, item.origin]),
  [
    ['SHANDONG KANGBEITE FOOD PACKAGING MACHINERY CO., LTD.', 'MASTER'],
    ['WENZHOU HUAQIAO PACKING MACHINE FACTORY', 'CIPL_SCAN'],
    ['WUHU CHURUI', 'MASTER'],
  ],
  'nama master menang untuk baris yang tertaut; hanya yang belum dikenal tetap CIPL_SCAN',
)
// Master yang logistiknya masih kosong terisi dari snapshot job; yang sudah ada tidak ditimpa.
const kangbeite = merged.peserta.find((item) => item.name.startsWith('SHANDONG'))
assert.equal(kangbeite?.logistics?.booth, 'I328')
const churui = merged.peserta.find((item) => item.name === 'WUHU CHURUI')
assert.equal(churui?.logistics?.koli.totalCount, 3, 'logistik master menang atas snapshot job')
// Total blok tidak terhitung ganda: 3 (master churui) + 2 (kangbeite) + 2 (baris scan).
assert.equal(merged.totals.totalCount, 7)

// Job LOCAL tanpa agent: peserta kosong, view tetap sah.
const localView = buildManifestView({ ...job, agentId: null, kind: 'LOCAL', inward: null } as LocalJob, [exhibitor({})])
assert.equal(localView.peserta.length, 0)
assert.equal(localView.totals.totalCount, 0)

console.log('manifest view assembler passed')
