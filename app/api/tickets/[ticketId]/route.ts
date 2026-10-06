import { NextRequest, NextResponse } from 'next/server'
import { ticketAssignmentSchema, ticketEditInputSchema, ticketMoveSchema, validateStatusTransition } from '@/domain/ticket/validation'
import { assertActiveAssignee, getTicketApiContext, ticketApiFailure, toActivity, toComment, toTicket, type TicketRow } from '@/lib/supabase/ticket-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { ticketId: string } }

async function rowForTicket(ticketId: string) {
  const { client, workspaceId } = await getTicketApiContext()
  const { data, error } = await client.from('tickets').select('*').eq('workspace_id', workspaceId).eq('id', ticketId).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Ticket tidak ditemukan.')
  return { client, workspaceId, row: data as TicketRow }
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const { client, workspaceId, row } = await rowForTicket(params.ticketId)
    const [comments, activities] = await Promise.all([
      client.from('ticket_comments').select('*').eq('workspace_id', workspaceId).eq('ticket_id', params.ticketId).order('created_at').order('id'),
      client.from('ticket_activities').select('*').eq('workspace_id', workspaceId).eq('ticket_id', params.ticketId).order('occurred_at').order('id'),
    ])
    if (comments.error ?? activities.error) throw comments.error ?? activities.error
    return NextResponse.json({ ticket: toTicket(row), comments: (comments.data ?? []).map(toComment), activities: (activities.data ?? []).map(toActivity) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return ticketApiFailure(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const payload = await request.json()
    const action = payload?.action
    if (!['EDIT', 'ASSIGN', 'MOVE', 'TAKE'].includes(action)) throw new Error('Aksi ticket tidak valid.')
    const { client, workspaceId, userId, row } = await (async () => {
      const context = await getTicketApiContext()
      const { data, error } = await context.client.from('tickets').select('*').eq('workspace_id', context.workspaceId).eq('id', params.ticketId).maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Ticket tidak ditemukan.')
      return { ...context, row: data as TicketRow }
    })()
    if (action === 'EDIT') {
      const input = ticketEditInputSchema.parse(payload.input)
      const assigneeId = input.assigneeId === undefined ? row.assignee_id : input.assigneeId
      await assertActiveAssignee(client, assigneeId)
      const { data, error } = await client.rpc('edit_ticket', {
        p_workspace_id: workspaceId, p_actor_id: userId, p_ticket_id: params.ticketId,
        p_title: input.title, p_description: input.description ?? null,
        p_context_kind: input.context.kind, p_context_id: input.context.kind === 'GENERAL' ? null : input.context.id,
        p_priority: input.priority, p_assignee_id: assigneeId,
      }).single()
      if (error) throw error
      return NextResponse.json(toTicket(data as TicketRow))
    }
    if (action === 'ASSIGN') {
      const { assigneeId } = ticketAssignmentSchema.parse(payload.input)
      await assertActiveAssignee(client, assigneeId)
      const { data, error } = await client.rpc('assign_ticket', { p_workspace_id: workspaceId, p_actor_id: userId, p_ticket_id: params.ticketId, p_assignee_id: assigneeId }).single()
      if (error) throw error
      return NextResponse.json(toTicket(data as TicketRow))
    }
    if (action === 'TAKE') {
      const { data, error } = await client
        .rpc('assign_ticket', {
          p_workspace_id: workspaceId,
          p_actor_id: userId,
          p_ticket_id: params.ticketId,
          p_assignee_id: userId,
        })
        .single()
      if (error) throw error
      return NextResponse.json(toTicket(data as TicketRow))
    }
    const input = ticketMoveSchema.parse(payload.input)
    const transitionError = validateStatusTransition(row.status, input.status, input.reopenReason ?? null, input.completionNote ?? null)
    if (transitionError) throw new Error(transitionError)
    const { data, error } = await client.rpc('move_ticket', {
      p_workspace_id: workspaceId, p_actor_id: userId, p_ticket_id: params.ticketId, p_status: input.status,
      p_ordered_ticket_ids: input.orderedTicketIds ?? null, p_completion_note: input.completionNote ?? null, p_reopen_reason: input.reopenReason ?? null,
    }).single()
    if (error) throw error
    return NextResponse.json(toTicket(data as TicketRow))
  } catch (error) {
    return ticketApiFailure(error)
  }
}
