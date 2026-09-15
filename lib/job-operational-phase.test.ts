import * as assert from 'node:assert/strict'
import {
  getJobOperationalPhase,
  type JobOperationalPhaseInput,
} from './job-operational-phase'

function job(overrides: Partial<JobOperationalPhaseInput> = {}): JobOperationalPhaseInput {
  return {
    status: 'DRAFT',
    hasInboundDocument: false,
    hasInvoice: false,
    ciplStatus: 'MISSING',
    customsDocuments: [
      { applicable: true, status: 'NOT_STARTED' },
      { applicable: false, status: 'NOT_STARTED' },
    ],
    ...overrides,
  }
}

assert.equal(getJobOperationalPhase(job()).id, 'DRAFT')
assert.equal(
  getJobOperationalPhase(job({ hasInboundDocument: true, hasInvoice: true, ciplStatus: 'RECEIVED' })).id,
  'PREPARE',
)
assert.equal(
  getJobOperationalPhase(job({ hasInboundDocument: true, hasInvoice: true, ciplStatus: 'VERIFIED' })).id,
  'SUBMIT',
)
assert.equal(
  getJobOperationalPhase(job({
    hasInboundDocument: true,
    hasInvoice: true,
    ciplStatus: 'VERIFIED',
    customsDocuments: [{ applicable: true, status: 'SUBMITTED' }],
  })).id,
  'PROCESSING',
)
assert.equal(
  getJobOperationalPhase(job({
    hasInboundDocument: true,
    hasInvoice: true,
    ciplStatus: 'VERIFIED',
    customsDocuments: [{ applicable: true, status: 'RELEASED' }],
  })).id,
  'RELEASE',
)
assert.equal(getJobOperationalPhase(job({ status: 'COMPLETED' })).id, 'COMPLETED')
assert.equal(getJobOperationalPhase(job({ status: 'ON_HOLD' })).id, 'ON_HOLD')

console.log('job operational phase tests passed')
