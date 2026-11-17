import assert from 'node:assert/strict'

import { derivedStagesOf, jobStageLabel, stageCustomsDocument } from './regime'

// Dokumen per (rezim, tahap) — keputusan 2026-11-17.
assert.equal(stageCustomsDocument('TPPB_BC_23', 'INBOUND'), 'BC_2_3')
assert.equal(stageCustomsDocument('TPPB_BC_23', 'DISPOSAL'), 'BC_2_5')
assert.equal(stageCustomsDocument('TPPB_BC_23', 'RE_EXPORT'), 'BC_3_0')
assert.equal(stageCustomsDocument('TEMPORARY_IMPORT', 'INBOUND'), 'BC_2_0')
assert.equal(stageCustomsDocument('TEMPORARY_IMPORT', 'DISPOSAL'), 'BC_2_0')
assert.equal(stageCustomsDocument('TEMPORARY_IMPORT', 'RE_EXPORT'), 'BC_3_0')
assert.equal(stageCustomsDocument('ATA_CARNET', 'INBOUND'), 'CARNET')
assert.equal(stageCustomsDocument('ATA_CARNET', 'RE_EXPORT'), 'CARNET')
assert.equal(stageCustomsDocument('ATA_CARNET', 'DISPOSAL'), null)
assert.equal(stageCustomsDocument('PERMANENT_IMPORT', 'INBOUND'), 'BC_2_0')
assert.equal(stageCustomsDocument('PERMANENT_IMPORT', 'RE_EXPORT'), null)
assert.equal(stageCustomsDocument('ROAD_SHIPMENT', 'INBOUND'), null)

// Tahap turunan yang diperkenankan.
assert.deepEqual(derivedStagesOf('TPPB_BC_23'), ['DISPOSAL', 'RE_EXPORT'])
assert.deepEqual(derivedStagesOf('TEMPORARY_IMPORT'), ['DISPOSAL', 'RE_EXPORT'])
assert.deepEqual(derivedStagesOf('ATA_CARNET'), ['RE_EXPORT'])
assert.deepEqual(derivedStagesOf('PERMANENT_IMPORT'), [])

// Label tahap mengikuti dokumen rezim.
assert.equal(jobStageLabel('TPPB_BC_23', 'DISPOSAL'), 'BC 2.5')
assert.equal(jobStageLabel('TEMPORARY_IMPORT', 'DISPOSAL'), 'BC 2.0 (definitif)')
assert.equal(jobStageLabel('TEMPORARY_IMPORT', 'RE_EXPORT'), 'BC 3.0')
assert.equal(jobStageLabel('ATA_CARNET', 'RE_EXPORT'), 'Carnet re-ekspor')

console.log('job regime passed')
