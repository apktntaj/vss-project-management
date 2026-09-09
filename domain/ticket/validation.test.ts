import assert from 'node:assert/strict'
import { validateStatusTransition, validateTicket } from './validation'
import type { Ticket } from './types'

const ticket: Ticket = {
  id: 'ticket-1', assigneeId: 'user-1', context: { kind: 'EVENT', id: 'event-1' },
  title: 'Siapkan dokumen', description: null, status: 'TODO', order: 1,
  priority: 'NORMAL', completion: null, statusHistory: [],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}
assert.equal(validateTicket(ticket), null)
assert.equal(validateTicket({ ...ticket, context: { kind: 'JOB', id: 'job-1' } }), null)
assert.equal(validateStatusTransition('TODO', 'DONE', null, null), 'Catatan hasil wajib diisi untuk Done.')
assert.equal(validateStatusTransition('DONE', 'TODO', null, null), 'Alasan membuka kembali ticket wajib diisi.')
assert.equal(validateStatusTransition('PROGRESS', 'DONE', null, 'Selesai'), null)
