import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ticketCreateInputSchema } from '@/domain/ticket/validation'
import {
  assertActiveAssignee,
  getTicketApiContext,
  ticketApiFailure,
  toTicket,
  type TicketRow,
} from '@/lib/supabase/ticket-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function jobDefaultAssignee(
  client: SupabaseClient,
  workspaceId: string,
  context: { kind: 'GENERAL' } | { kind: 'EVENT'; id: string } | { kind: 'JOB'; id: string },
) {
  if (context.kind !== 'JOB') return null
  const { data, error } = await client.from('jobs').select('payload').eq('workspace_id', workspaceId).eq('id', context.id).maybeSingle<{ payload: { assignedToId?: string | null } }>()
  if (error || !data) throw new Error('Job tidak ditemukan.')
  return data.payload.assignedToId ?? null
}

export async function GET(request: NextRequest) {
  try {
    const { client, workspaceId, userId } = await getTicketApiContext()
    const scope = request.nextUrl.searchParams.get('scope') ?? 'mine'
    if (!['mine', 'unassigned', 'all'].includes(scope)) throw new Error('Scope ticket tidak valid.')
    let query = client.from('tickets').select('*').eq('workspace_id', workspaceId)
    if (scope === 'mine') query = query.eq('assignee_id', userId)
    if (scope === 'unassigned') query = query.is('assignee_id', null)
    const contextKind = request.nextUrl.searchParams.get('contextKind')
    const contextId = request.nextUrl.searchParams.get('contextId')
    if ((contextKind && !contextId) || (!contextKind && contextId) || (contextKind && !['EVENT', 'JOB'].includes(contextKind))) throw new Error('Filter konteks tidak valid.')
    if (contextKind && contextId) query = query.eq('context_kind', contextKind).eq('context_id', contextId)
    const { data, error } = await query.order('status').order('sort_order')
    if (error) throw error
    return NextResponse.json((data as TicketRow[]).map(toTicket), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return ticketApiFailure(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = ticketCreateInputSchema.parse(await request.json())
    const { client, workspaceId, userId } = await getTicketApiContext()
    const defaultAssignee = input.assigneeId === undefined ? await jobDefaultAssignee(client, workspaceId, input.context) : input.assigneeId
    await assertActiveAssignee(client, defaultAssignee ?? null)
    const { data, error } = await client.rpc('create_ticket', {
      p_workspace_id: workspaceId,
      p_actor_id: userId,
      p_id: crypto.randomUUID(),
      p_title: input.title,
      p_description: input.description ?? null,
      p_context_kind: input.context.kind,
      p_context_id: input.context.kind === 'GENERAL' ? null : input.context.id,
      p_priority: input.priority,
      p_assignee_id: defaultAssignee ?? null,
    }).single()
    if (error) throw error
    return NextResponse.json(toTicket(data as TicketRow), { status: 201 })
  } catch (error) {
    return ticketApiFailure(error)
  }
}
