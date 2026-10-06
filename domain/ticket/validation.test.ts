import assert from 'node:assert/strict'
import {
  ticketCommentSchema,
  ticketContextSchema,
  validateStatusTransition,
  validateTicket,
} from './validation'
import type { Ticket } from './types'

const ticket: Ticket = {
  id: 'ticket-1',
  ticketNumber: 1,
  creatorId: 'user-1',
  assigneeId: null,
  context: { kind: 'GENERAL' },
  title: 'Siapkan dokumen',
  description: null,
  status: 'TODO',
  order: 1,
  priority: 'NORMAL',
  completion: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastActivityAt: '2026-01-01T00:00:00.000Z',
}

assert.equal(validateTicket(ticket), null)
assert.equal(validateTicket({ ...ticket, context: { kind: 'EVENT', id: 'event-1' } }), null)
assert.equal(ticketContextSchema.safeParse({ kind: 'GENERAL' }).success, true)
assert.equal(ticketContextSchema.safeParse({ kind: 'EVENT', id: '' }).success, false)
assert.equal(ticketContextSchema.safeParse({ kind: 'JOB', id: '' }).success, false)
assert.equal(ticketCommentSchema.safeParse({ body: '   ' }).success, false)
assert.equal(validateStatusTransition('TODO', 'DONE', null, null), 'Catatan hasil wajib diisi untuk Done.')
assert.equal(validateStatusTransition('DONE', 'TODO', null, null), 'Alasan membuka kembali ticket wajib diisi.')
assert.equal(validateStatusTransition('PROGRESS', 'DONE', null, 'Selesai'), null)
