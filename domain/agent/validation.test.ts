import assert from 'node:assert/strict'
import { agentRecordSchema } from './validation'

const record = {
  id: '3f0c2a52-6b0e-4d6e-9d3a-0d1f6c1a9e11',
  name: 'Agent Contoh',
  contact: { name: 'Budi', role: null, email: 'budi@agent.test', phone: null },
  address: null,
  countryCode: 'SG',
  status: 'ACTIVE',
  createdAt: '2026-11-19T01:00:00.000Z',
  updatedAt: '2026-11-19T01:00:00.000Z',
}

assert.equal(agentRecordSchema.safeParse(record).success, true)
assert.equal(agentRecordSchema.safeParse({ ...record, name: '' }).success, false)
assert.equal(agentRecordSchema.safeParse({ ...record, status: 'DELETED' }).success, false)
assert.equal(agentRecordSchema.safeParse({ ...record, id: undefined }).success, false)
assert.equal(agentRecordSchema.safeParse({ ...record, createdAt: 'kemarin' }).success, false)
// Field di luar definisi tidak ikut tersimpan.
assert.equal('isAdmin' in agentRecordSchema.parse({ ...record, isAdmin: true }), false)
