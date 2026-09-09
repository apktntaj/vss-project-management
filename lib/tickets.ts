import { nanoid } from 'nanoid'

export type TicketContext =
  | { kind: 'GENERAL' }
  | { kind: 'EVENT'; eventId: string }
  | { kind: 'JOB'; jobId: string }
export type TicketPriority = 'NORMAL' | 'URGENT'
export type TicketStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export type TicketAssignee = string | null
export type Ticket = {
  id: string; title: string; description: string; context: TicketContext
  priority: TicketPriority; status: TicketStatus; assigneeId: TicketAssignee
  creatorId: string; createdAt: string; updatedAt: string
}
export type TicketComment = { id: string; ticketId: string; authorId: string; body: string; createdAt: string }
export type TicketActivityKind = 'CREATED' | 'UPDATED' | 'ASSIGNMENT_CHANGED' | 'STATUS_CHANGED' | 'COMMENTED'
export type TicketActivity = { id: string; ticketId: string; kind: TicketActivityKind; actorId: string; occurredAt: string; summary: string }
export type TicketInput = { title: string; description?: string; context: TicketContext; priority?: TicketPriority }
export type TicketUpdate = { title: string; description: string; context: TicketContext; priority: TicketPriority }

const trim = (value: string) => value.trim()
const now = () => new Date().toISOString()
function assertText(value: string, label: string) { if (!trim(value)) throw new Error(`${label} tidak boleh kosong`) }
function clone<T>(value: T): T { return structuredClone(value) }

class InMemoryTicketStore {
  private tickets = new Map<string, Ticket>()
  private comments = new Map<string, TicketComment>()
  private activities = new Map<string, TicketActivity>()
  private listeners = new Set<() => void>()
  constructor() { this.seed() }
  private emit() { this.listeners.forEach((listener) => listener()) }
  private activity(ticketId: string, actorId: string, kind: TicketActivityKind, summary: string) {
    const item: TicketActivity = { id: nanoid(), ticketId, actorId, kind, summary, occurredAt: now() }
    this.activities.set(item.id, item)
  }
  private seed() {
    const createdAt = new Date(Date.now() - 3 * 86_400_000).toISOString()
    const samples: Ticket[] = [
      { id: 'ticket-demo-general', title: 'Minta packing list dari exhibitor', description: 'Konfirmasi dokumen sebelum shipment diterima.', context: { kind: 'GENERAL' }, priority: 'URGENT', status: 'TODO', assigneeId: null, creatorId: 'local-user', createdAt, updatedAt: createdAt },
      { id: 'ticket-demo-event', title: 'Konfirmasi jadwal move-in venue', description: 'Koordinasikan slot loading untuk event.', context: { kind: 'EVENT', eventId: 'demo-event-retail-summit' }, priority: 'NORMAL', status: 'IN_PROGRESS', assigneeId: 'demo-user-ari', creatorId: 'local-user', createdAt, updatedAt: createdAt },
      { id: 'ticket-demo-job', title: 'Siapkan driver untuk pickup', description: 'Atur driver dan kendaraan untuk pickup cargo.', context: { kind: 'JOB', jobId: 'demo-job-retail-1' }, priority: 'URGENT', status: 'DONE', assigneeId: 'demo-user-maya', creatorId: 'demo-user-ari', createdAt, updatedAt: createdAt },
      { id: 'ticket-demo-cancelled', title: 'Tindak lanjuti persetujuan customer', description: '', context: { kind: 'GENERAL' }, priority: 'NORMAL', status: 'CANCELLED', assigneeId: null, creatorId: 'local-user', createdAt, updatedAt: createdAt },
    ]
    samples.forEach((ticket) => { this.tickets.set(ticket.id, ticket); this.activity(ticket.id, ticket.creatorId, 'CREATED', 'Ticket dibuat') })
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  list() { return [...this.tickets.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone) }
  get(id: string) { const ticket = this.tickets.get(id); return ticket ? clone(ticket) : null }
  create(input: TicketInput, actorId: string) {
    assertText(input.title, 'Judul'); const timestamp = now()
    const ticket: Ticket = { id: nanoid(), title: trim(input.title), description: trim(input.description ?? ''), context: input.context, priority: input.priority ?? 'NORMAL', status: 'TODO', assigneeId: null, creatorId: actorId, createdAt: timestamp, updatedAt: timestamp }
    this.tickets.set(ticket.id, ticket); this.activity(ticket.id, actorId, 'CREATED', 'Ticket dibuat'); this.emit(); return clone(ticket)
  }
  update(id: string, input: TicketUpdate, actorId: string) {
    const ticket = this.tickets.get(id); if (!ticket) throw new Error('Ticket tidak ditemukan'); assertText(input.title, 'Judul')
    const changed = (['title', 'description', 'priority', 'context'] as const).filter((key) => JSON.stringify(ticket[key]) !== JSON.stringify(input[key]))
    Object.assign(ticket, { title: trim(input.title), description: trim(input.description), context: input.context, priority: input.priority, updatedAt: now() })
    if (changed.length) this.activity(id, actorId, 'UPDATED', `${changed.join(', ')} diperbarui`)
    this.emit(); return clone(ticket)
  }
  assign(id: string, assigneeId: TicketAssignee, actorId: string) {
    const ticket = this.tickets.get(id); if (!ticket) throw new Error('Ticket tidak ditemukan'); const previous = ticket.assigneeId
    ticket.assigneeId = assigneeId; ticket.updatedAt = now()
    const summary = assigneeId ? (previous ? 'Assignment dipindahkan' : 'Ticket diassign') : 'Ticket dikembalikan ke antrean unassigned'
    this.activity(id, actorId, 'ASSIGNMENT_CHANGED', summary); this.emit(); return clone(ticket)
  }
  transition(id: string, status: TicketStatus, actorId: string) {
    const ticket = this.tickets.get(id); if (!ticket) throw new Error('Ticket tidak ditemukan'); if (ticket.status !== status) {
      ticket.status = status; ticket.updatedAt = now(); this.activity(id, actorId, 'STATUS_CHANGED', `Status diubah ke ${status}`); this.emit()
    }; return clone(ticket)
  }
  comment(ticketId: string, body: string, authorId: string) {
    if (!this.tickets.has(ticketId)) throw new Error('Ticket tidak ditemukan'); assertText(body, 'Komentar')
    const comment: TicketComment = { id: nanoid(), ticketId, authorId, body: trim(body), createdAt: now() }
    this.comments.set(comment.id, comment); this.activity(ticketId, authorId, 'COMMENTED', 'Menambahkan komentar'); this.emit(); return clone(comment)
  }
  timeline(ticketId: string) {
    const timestamp = (item: TicketComment | TicketActivity) => 'createdAt' in item ? item.createdAt : item.occurredAt
    return [...this.comments.values().filter((item) => item.ticketId === ticketId), ...this.activities.values().filter((item) => item.ticketId === ticketId)].sort((a, b) => timestamp(a).localeCompare(timestamp(b)) || a.id.localeCompare(b.id)).map(clone)
  }
  remove(id: string) { if (!this.tickets.delete(id)) return false; for (const [key, value] of this.comments) if (value.ticketId === id) this.comments.delete(key); for (const [key, value] of this.activities) if (value.ticketId === id) this.activities.delete(key); this.emit(); return true }
}
const store = new InMemoryTicketStore()
export const ticketStore = {
  subscribe: (listener: () => void) => store.subscribe(listener), listTickets: () => store.list(), getTicket: (id: string) => store.get(id),
  createTicket: (input: TicketInput, actorId: string) => store.create(input, actorId), updateTicket: (id: string, input: TicketUpdate, actorId: string) => store.update(id, input, actorId),
  assignTicket: (id: string, assigneeId: TicketAssignee, actorId: string) => store.assign(id, assigneeId, actorId), transitionTicket: (id: string, status: TicketStatus, actorId: string) => store.transition(id, status, actorId),
  addTicketComment: (id: string, body: string, actorId: string) => store.comment(id, body, actorId), listTicketTimeline: (id: string) => store.timeline(id), deleteTicket: (id: string) => store.remove(id),
}
