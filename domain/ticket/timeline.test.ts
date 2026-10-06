import assert from 'node:assert/strict'
import { compareTicketTimeline } from './timeline'

const at = '2026-01-01T00:00:00.000Z'
const activity = { type: 'ACTIVITY' as const, id: 'b', ticketId: 't', actorId: null, occurredAt: at, kind: 'CREATED' as const, change: {} }
const comment = { type: 'COMMENT' as const, id: 'a', ticketId: 't', authorId: 'u', body: 'Catatan', createdAt: at }
assert.equal([activity, comment].sort(compareTicketTimeline)[0].id, 'a')
