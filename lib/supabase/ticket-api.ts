import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Ticket, TicketActivity, TicketComment } from '@/domain/ticket/types'
import { getEventApiContext } from './event-api'

export type TicketRow = {
  id: string
  ticket_number: number
  creator_id: string | null
  assignee_id: string | null
  context_kind: 'GENERAL' | 'EVENT' | 'JOB'
  context_id: string | null
  title: string
  description: string | null
  status: Ticket['status']
  sort_order: number
  priority: Ticket['priority']
  completion_note: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  last_activity_at: string
}

export function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    creatorId: row.creator_id,
    assigneeId: row.assignee_id,
    context: row.context_kind === 'GENERAL' ? { kind: 'GENERAL' } : { kind: row.context_kind, id: row.context_id ?? '' },
    title: row.title,
    description: row.description,
    status: row.status,
    order: row.sort_order,
    priority: row.priority,
    completion: row.completed_at && row.completion_note ? { note: row.completion_note, completedAt: row.completed_at } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActivityAt: row.last_activity_at,
  }
}

export function toComment(row: { id: string; ticket_id: string; author_id: string; body: string; created_at: string }): TicketComment {
  return { id: row.id, ticketId: row.ticket_id, authorId: row.author_id, body: row.body, createdAt: row.created_at }
}

export function toActivity(row: { id: string; ticket_id: string; actor_id: string | null; kind: TicketActivity['kind']; change: TicketActivity['change']; occurred_at: string }): TicketActivity {
  return { id: row.id, ticketId: row.ticket_id, actorId: row.actor_id, kind: row.kind, change: row.change, occurredAt: row.occurred_at } as TicketActivity
}

export async function getTicketApiContext() {
  const context = await getEventApiContext()
  const { data: user, error } = await context.client
    .from('app_users')
    .select('is_active')
    .eq('id', context.userId)
    .single<{ is_active: boolean }>()
  if (error || !user?.is_active) throw new Error('Akun aktif diperlukan.')
  return context
}

export async function assertActiveAssignee(client: SupabaseClient, assigneeId: string | null) {
  if (!assigneeId) return
  const { data, error } = await client
    .from('app_users')
    .select('id')
    .eq('id', assigneeId)
    .eq('is_active', true)
    .maybeSingle()
  if (error || !data) throw new Error('Assignee harus pengguna aktif.')
}

export function ticketApiFailure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Ticket tidak dapat diproses.'
  const status = message === 'Autentikasi diperlukan.' ? 401 : message === 'Ticket tidak ditemukan.' ? 404 : 400
  return NextResponse.json({ error: message }, { status })
}
