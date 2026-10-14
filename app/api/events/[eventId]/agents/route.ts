import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { eventApiFailure, getEventApiContext } from '@/lib/supabase/event-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

type AgentPayload = {
  id: string
  name: string
  contact: Record<string, unknown> | null
  address: string | null
  countryCode: string | null
  status: string
  createdAt: string
  updatedAt: string
}

type ParticipationRow = {
  id: string
  event_id: string
  agent_id: string
  created_by_id: string | null
  created_at: string
}

function toView(row: ParticipationRow, agent: AgentPayload) {
  return {
    id: row.id,
    eventId: row.event_id,
    agentId: row.agent_id,
    createdAt: row.created_at,
    createdById: row.created_by_id,
    agent,
  }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { client, workspaceId } = await getEventApiContext()
    const [participationsResult, agentsResult] = await Promise.all([
      client
        .from('event_agents')
        .select('id, event_id, agent_id, created_by_id, created_at')
        .eq('workspace_id', workspaceId)
        .eq('event_id', params.eventId)
        .order('created_at'),
      client.from('agents').select('payload').eq('workspace_id', workspaceId),
    ])
    if (participationsResult.error) throw participationsResult.error
    if (agentsResult.error) throw agentsResult.error

    const agentsById = new Map(
      ((agentsResult.data ?? []) as Array<{ payload: AgentPayload }>).map((row) => [row.payload.id, row.payload]),
    )
    const views = ((participationsResult.data ?? []) as ParticipationRow[]).flatMap((row) => {
      const agent = agentsById.get(row.agent_id)
      return agent ? [toView(row, agent)] : []
    })
    return NextResponse.json(views, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return eventApiFailure(error)
  }
}

const addAgentSchema = z.object({ agentId: z.string().min(1) })

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { agentId } = addAgentSchema.parse(await request.json())
    const { client, workspaceId, userId } = await getEventApiContext()
    const { data: event, error: eventError } = await client
      .from('events')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('id', params.eventId)
      .single<{ id: string }>()
    if (eventError || !event) throw new Error('Event tidak ditemukan.')

    const { data: agent, error: agentError } = await client
      .from('agents')
      .select('payload')
      .eq('workspace_id', workspaceId)
      .eq('id', agentId)
      .maybeSingle<{ payload: AgentPayload }>()
    if (agentError) throw agentError
    if (!agent) throw new Error('Agent tidak ditemukan.')

    // Idempoten: partisipasi yang sudah ada dikembalikan apa adanya.
    const { data: existing, error: existingError } = await client
      .from('event_agents')
      .select('id, event_id, agent_id, created_by_id, created_at')
      .eq('workspace_id', workspaceId)
      .eq('event_id', params.eventId)
      .eq('agent_id', agentId)
      .maybeSingle<ParticipationRow>()
    if (existingError) throw existingError
    if (existing) {
      return NextResponse.json(toView(existing, agent.payload), {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const { data: inserted, error: insertError } = await client
      .from('event_agents')
      .insert({
        workspace_id: workspaceId,
        id: crypto.randomUUID(),
        event_id: params.eventId,
        agent_id: agentId,
        created_by_id: userId,
      })
      .select('id, event_id, agent_id, created_by_id, created_at')
      .single<ParticipationRow>()
    if (insertError) throw insertError

    return NextResponse.json(toView(inserted, agent.payload), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return eventApiFailure(error)
  }
}
