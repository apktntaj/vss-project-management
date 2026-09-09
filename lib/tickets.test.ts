import assert from 'node:assert/strict'
import { ticketStore } from './tickets'

const actor = 'local-user'
assert.throws(() => ticketStore.createTicket({ title: ' ', context: { kind: 'GENERAL' } }, actor))
const ticket = ticketStore.createTicket({ title: '  Driver pickup  ', description: '  Siapkan kendaraan  ', context: { kind: 'EVENT', eventId: 'event-1' }, priority: 'URGENT' }, actor)
assert.equal(ticket.title, 'Driver pickup')
assert.equal(ticket.status, 'TODO')
ticketStore.assignTicket(ticket.id, 'demo-user-ari', actor)
ticketStore.transitionTicket(ticket.id, 'IN_PROGRESS', actor)
assert.throws(() => ticketStore.addTicketComment(ticket.id, ' ', actor))
ticketStore.addTicketComment(ticket.id, 'Driver telah dihubungi', actor)
const timeline = ticketStore.listTicketTimeline(ticket.id)
assert.equal(timeline.filter((item) => !('body' in item)).length >= 3, true)
assert.equal(timeline.some((item) => 'body' in item), true)
assert.equal(ticketStore.deleteTicket(ticket.id), true)
assert.equal(ticketStore.getTicket(ticket.id), null)
assert.equal(ticketStore.listTicketTimeline(ticket.id).length, 0)
console.log('ticket store validation passed')
