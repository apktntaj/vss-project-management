import type { Ticket, TicketContext, TicketStatus } from './types'

export function validateTicket(ticket: Ticket): string | null {
  if (!ticket.assigneeId) return 'User aktif wajib tersedia.'
  if (!ticket.title.trim()) return 'Judul ticket wajib diisi.'
  if (!ticket.context.id) return 'Konteks ticket wajib diisi.'
  if (ticket.context.kind !== 'EVENT' && ticket.context.kind !== 'JOB')
    return 'Konteks ticket harus Event atau Job.'
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
