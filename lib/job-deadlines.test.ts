import assert from 'node:assert/strict'

import {
  DEADLINE_CRITICAL_DAYS,
  DEADLINE_WARNING_DAYS,
  daysUntil,
  deadlineCountdown,
  deadlineLevel,
  jobDeadlines,
} from './job-deadlines'
import type { Job } from '@/domain/job/types'

const now = new Date(2026, 10, 18, 15, 30) // 18 Nov 2026, siang hari (jam tidak boleh memengaruhi hari)

// (1) Hitung hari kalender.
assert.equal(daysUntil('2026-11-18', now), 0)
assert.equal(daysUntil('2026-11-19', now), 1)
assert.equal(daysUntil('2026-11-17', now), -1)
assert.equal(daysUntil('2026-12-02T00:00:00.000Z', now), 14)
assert.equal(daysUntil('bukan tanggal', now), null)

// (2) Tingkat peringatan mengikuti ambang.
assert.equal(deadlineLevel(-1), 'expired')
assert.equal(deadlineLevel(0), 'critical')
assert.equal(deadlineLevel(DEADLINE_CRITICAL_DAYS), 'critical')
assert.equal(deadlineLevel(DEADLINE_CRITICAL_DAYS + 1), 'warning')
assert.equal(deadlineLevel(DEADLINE_WARNING_DAYS), 'warning')
assert.equal(deadlineLevel(DEADLINE_WARNING_DAYS + 1), 'ok')

assert.equal(deadlineCountdown(0), 'hari ini')
assert.equal(deadlineCountdown(5), '5 hari lagi')
assert.equal(deadlineCountdown(-3), 'terlewat 3 hari')

const job = (overrides: Record<string, unknown>) =>
  ({
    status: 'ACTIVE',
    stage: 'INBOUND',
    sourceJobId: null,
    internationalJenis: 'TEMPORARY_IMPORT',
    operational: { guarantee: { kind: 'CASH', number: null, amount: null, currency: null, reExportDeadline: '2026-11-25' } },
    ...overrides,
  }) as unknown as Job

// (3) Temporary Import: job masuk membaca jaminannya sendiri.
const ti = jobDeadlines(job({}), null, now)
assert.equal(ti.length, 1)
assert.equal(ti[0].kind, 'REEXPORT')
assert.equal(ti[0].daysLeft, 7)
assert.equal(ti[0].level, 'critical')
assert.equal(ti[0].fromSource, false)

// (4) Job re-ekspor membaca dari job masuk; tanpa job masuk tidak ada tenggat.
const reexport = job({ stage: 'RE_EXPORT', sourceJobId: 'src', operational: {} })
assert.equal(jobDeadlines(reexport, null, now).length, 0)
const fromSource = jobDeadlines(reexport, job({}), now)
assert.equal(fromSource[0].fromSource, true)
assert.equal(fromSource[0].daysLeft, 7)

// (5) ATA Carnet: masa berlaku carnet.
const carnetJob = job({
  internationalJenis: 'ATA_CARNET',
  operational: { carnet: { number: 'X', issuingCountry: null, guarantor: null, validUntil: '2026-11-10' } },
})
const ata = jobDeadlines(carnetJob, null, now)
assert.equal(ata[0].kind, 'CARNET')
assert.equal(ata[0].level, 'expired')
assert.equal(ata[0].daysLeft, -8)

// (6) Disposal, job batal, dan rezim lain tidak punya tenggat.
assert.equal(jobDeadlines(job({ stage: 'DISPOSAL' }), null, now).length, 0)
assert.equal(jobDeadlines(job({ status: 'CANCELLED' }), null, now).length, 0)
assert.equal(jobDeadlines(job({ internationalJenis: 'TPPB_BC_23' }), null, now).length, 0)

console.log('job-deadlines: ok')
