import assert from 'node:assert/strict'

import { exhibitorCreateSchema, exhibitorUpdateSchema } from './validation'

const created = exhibitorCreateSchema.parse({ name: ' ACME GmbH ', kind: 'INTERNATIONAL', hall: '', booth: 'A1' })
assert.equal(created.name, 'ACME GmbH')
assert.equal(created.hall, null)
assert.equal(created.booth, 'A1')
assert.deepEqual(created.contact, { name: null, role: null, email: null, phone: null })
// NPWP hanya untuk exhibitor lokal.
assert.equal(exhibitorCreateSchema.safeParse({ name: 'X', kind: 'INTERNATIONAL', npwp: '01.234' }).success, false)
assert.equal(exhibitorCreateSchema.safeParse({ name: 'X', kind: 'LOCAL', npwp: '01.234' }).success, true)
// Agent bukan atribut exhibitor.
assert.equal(exhibitorCreateSchema.safeParse({ name: 'X', kind: 'LOCAL', agentId: 'a' }).success, false)

// Patch: field yang tidak dikirim tetap undefined (tidak ditulis); kosong mengosongkan.
const patch = exhibitorUpdateSchema.parse({ booth: '' })
assert.equal(patch.booth, null)
assert.equal(patch.hall, undefined)
assert.equal(patch.name, undefined)

console.log('exhibitor validation passed')
