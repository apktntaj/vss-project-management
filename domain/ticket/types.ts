/** Storage-neutral collaborative work ticket domain. */
export type TicketContext =
  | { kind: 'GENERAL' }
  | { kind: 'EVENT'; id: string }
  | { kind: 'JOB'; id: string }

export type TicketStatus = 'TODO' | 'PROGRESS' | 'DONE'
export type TicketPriority = 'NORMAL' | 'URGENT'

export type TicketCompletion = { note: string; completedAt: string }

export type Ticket = {
  id: string
  ticketNumber: number
  creatorId: string | null
  assigneeId: string | null
  context: TicketContext
  title: string
  description: string | null
  status: TicketStatus
  order: number
  priority: TicketPriority
  completion: TicketCompletion | null
  createdAt: string
  updatedAt: string
  lastActivityAt: string
}

export type TicketComment = {
  id: string
  ticketId: string
  authorId: string
  body: string
  createdAt: string
}

export type TicketActivity =
  | {
      id: string
      ticketId: string
      actorId: string | null
      occurredAt: string
      kind: 'CREATED'
      change: Record<string, never>
    }
  | {
      id: string
      ticketId: string
      actorId: string | null
      occurredAt: string
      kind: 'DETAILS_CHANGED'
      change: {
        fields: Array<{
          field: 'TITLE' | 'DESCRIPTION' | 'PRIORITY' | 'CONTEXT'
          before: string | null
          after: string | null
        }>
      }
    }
  | {
      id: string
      ticketId: string
      actorId: string | null
      occurredAt: string
      kind: 'ASSIGNEE_CHANGED'
      change: { before: string | null; after: string | null }
    }
  | {
      id: string
      ticketId: string
      actorId: string | null
      occurredAt: string
      kind: 'STATUS_CHANGED'
      change: {
        before: TicketStatus
        after: TicketStatus
        note: string | null
      }
    }
