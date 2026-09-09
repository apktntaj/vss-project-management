/** Storage-neutral personal work ticket domain. */
export type TicketContext =
  | { kind: 'EVENT'; id: string }
  | { kind: 'GENERAL_CARGO'; id: string }
  | { kind: 'PROJECT'; id: string }

export type TicketStatus = 'TODO' | 'PROGRESS' | 'DONE'
export type TicketPriority = 'NORMAL' | 'URGENT'

export type TicketBlocker = {
  reason: string
  nextAction: string
  createdAt: string
  resolvedAt: string | null
  resolution: string | null
}

export type TicketCompletion = { note: string; completedAt: string }
export type TicketStatusChange = {
  from: TicketStatus
  to: TicketStatus
  reason: string | null
  changedAt: string
}

export type Ticket = {
  id: string
  assigneeId: string
  context: TicketContext
  title: string
  description: string | null
  dueOn: string | null
  status: TicketStatus
  order: number
  priority: TicketPriority
  blocker: TicketBlocker | null
  completion: TicketCompletion | null
  statusHistory: TicketStatusChange[]
  createdAt: string
  updatedAt: string
}
