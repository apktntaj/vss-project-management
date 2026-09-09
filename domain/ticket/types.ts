/** Storage-neutral personal work ticket domain. */
export type TicketContext =
  | { kind: 'EVENT'; id: string }
  | { kind: 'JOB'; id: string }

export type TicketStatus = 'TODO' | 'PROGRESS' | 'DONE'
export type TicketPriority = 'NORMAL' | 'URGENT'

export type TicketCompletion = { note: string; completedAt: string }
export type TicketStatusChange = {
  from: TicketStatus
  to: TicketStatus
  reason: string | null
  changedAt: string
}

export type Ticket = {
  id: string
  ticketNumber: number
  eventId: string
  assigneeId: string
  context: TicketContext
  title: string
  description: string | null
  status: TicketStatus
  order: number
  priority: TicketPriority
  completion: TicketCompletion | null
  statusHistory: TicketStatusChange[]
  createdAt: string
  updatedAt: string
}
