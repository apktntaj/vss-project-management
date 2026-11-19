import assert from 'node:assert/strict'

import { inboundSlot, loadedSeries, seriesStateOnReload, stageSlot, type JobSeriesState } from './job-series'
import type { Job, JobSummary } from '@/domain/job/types'

function summary(id: string, stage: JobSummary['stage']): JobSummary {
  return { id, stage } as JobSummary
}

const loading: JobSeriesState = { kind: 'LOADING' }
const failed: JobSeriesState = { kind: 'FAILED' }
const loaded: JobSeriesState = {
  kind: 'LOADED',
  rootId: 'root',
  summaries: [summary('d1', 'DISPOSAL')],
}

// Memuat dan gagal tidak pernah menjadi "belum ada".
assert.deepEqual(stageSlot(loading, 'DISPOSAL'), { kind: 'LOADING' })
assert.deepEqual(stageSlot(failed, 'DISPOSAL'), { kind: 'FAILED' })

// Termuat: tahap yang ada ditautkan, yang tidak ada baru "belum ada".
assert.deepEqual(stageSlot(loaded, 'DISPOSAL'), { kind: 'FOUND', job: summary('d1', 'DISPOSAL') })
assert.deepEqual(stageSlot(loaded, 'RE_EXPORT'), { kind: 'EMPTY' })
assert.deepEqual(stageSlot({ kind: 'LOADED', rootId: 'root', summaries: [] }, 'DISPOSAL'), {
  kind: 'EMPTY',
})

// Tahap job masuk: job ada -> ditautkan; belum ada ikut keadaan pemuatan.
const inbound = { id: 'root' } as Job
assert.deepEqual(inboundSlot(inbound, loading), { kind: 'FOUND', job: inbound })
assert.deepEqual(inboundSlot(null, loading), { kind: 'LOADING' })
assert.deepEqual(inboundSlot(null, failed), { kind: 'FAILED' })
assert.deepEqual(inboundSlot(null, loaded), { kind: 'EMPTY' })

// Muat ulang rangkaian yang sama mempertahankan data lama; rangkaian lain atau gagal kembali memuat.
assert.equal(seriesStateOnReload(loaded, 'root'), loaded)
assert.deepEqual(seriesStateOnReload(loaded, 'other'), loading)
assert.deepEqual(seriesStateOnReload(failed, 'root'), loading)
assert.deepEqual(seriesStateOnReload(loading, 'root'), loading)

// Peringatan selisih hanya dihitung dari rangkaian yang termuat.
assert.equal(loadedSeries(loading), null)
assert.equal(loadedSeries(failed), null)
assert.deepEqual(loadedSeries(loaded), [summary('d1', 'DISPOSAL')])

console.log('job-series tests passed')
