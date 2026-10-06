import { z } from 'zod'
import type { Ticket, TicketStatus } from './types'

const requiredText = z.string().trim().min(1, 'Wajib diisi.')
const nullableText = z.string().trim().min(1).nullable().optional()

export const ticketContextSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('GENERAL') }).strict(),
  z.object({ kind: z.literal('EVENT'), id: requiredText }).strict(),
  z.object({ kind: z.literal('JOB'), id: requiredText }).strict(),
])

const ticketDetailsSchema = {
  title: requiredText,
  description: nullableText,
  context: ticketContextSchema,
  priority: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
}

export const ticketCreateInputSchema = z.object({
  ...ticketDetailsSchema,
  assigneeId: z.string().trim().min(1).nullable().optional(),
}).strict()

export const ticketEditInputSchema = z.object({
  ...ticketDetailsSchema,
  assigneeId: z.string().trim().min(1).nullable().optional(),
}).strict()

export const ticketAssignmentSchema = z.object({
  assigneeId: z.string().trim().min(1).nullable(),
}).strict()

export const ticketMoveSchema = z.object({
  status: z.enum(['TODO', 'PROGRESS', 'DONE']),
  orderedTicketIds: z.array(z.string().trim().min(1)).optional(),
  completionNote: nullableText,
  reopenReason: nullableText,
}).strict()

export const ticketCommentSchema = z.object({
  body: requiredText,
}).strict()

export function validateTicket(ticket: Ticket): string | null {
  if (!ticket.title.trim()) return 'Judul ticket wajib diisi.'
  if (ticket.context.kind !== 'GENERAL' && !ticket.context.id.trim())
    return 'Konteks ticket wajib diisi.'
  if (ticket.status === 'DONE' && !ticket.completion?.note.trim())
    return 'Catatan hasil wajib untuk menyelesaikan ticket.'
  if (ticket.status !== 'DONE' && ticket.completion) return 'Completion hanya tersedia untuk ticket Done.'
  return null
}

export function validateStatusTransition(
  from: TicketStatus,
  to: TicketStatus,
  reason: string | null,
  completionNote: string | null,
): string | null {
  if (to === 'DONE' && !completionNote?.trim()) return 'Catatan hasil wajib diisi untuk Done.'
  if (from === 'DONE' && to !== 'DONE' && !reason?.trim())
    return 'Alasan membuka kembali ticket wajib diisi.'
  return null
}
