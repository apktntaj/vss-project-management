import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { exhibitorInputSchema } from '@/domain/event/validation'
import { eventApiFailure, getEventApiContext } from '@/lib/supabase/event-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { client, workspaceId } = await getEventApiContext()
    const { data, error } = await client
      .from('exhibitors')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('event_id', params.eventId)
      .order('name')
    if (error) throw error

    return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return eventApiFailure(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const inputs = exhibitorInputSchema.array().min(1).parse(await request.json())
    const { client, workspaceId, userId } = await getEventApiContext()
    const { data: event, error: eventError } = await client
      .from('events')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('id', params.eventId)
      .single<{ id: string }>()
    if (eventError || !event) throw new Error('Event tidak ditemukan.')

    const timestamp = new Date().toISOString()
    const rows = inputs.map((input) => ({
      workspace_id: workspaceId,
      id: crypto.randomUUID(),
      event_id: params.eventId,
      name: input.name,
      kind: input.kind,
      contact: input.contact,
      agent_id: input.agentId,
      npwp: input.kind === 'LOCAL' ? input.npwp : null,
      created_by_id: userId,
      created_at: timestamp,
      updated_at: timestamp,
      payload: input,
    }))
    const { error } = await client.from('exhibitors').insert(rows)
    if (error) throw error

    return NextResponse.json(
      rows.map((row, index) => ({
        id: row.id,
        eventId: row.event_id,
        ...inputs[index],
        createdAt: timestamp,
        createdById: userId,
        updatedAt: timestamp,
      })),
    )
  } catch (error) {
    return eventApiFailure(error)
  }
}

const patchSchema = z.object({
  exhibitorId: z.string().min(1),
  agentId: z.string().min(1).nullable(),
})

/** Menetapkan atau melepas agent pembawa sebuah exhibitor pada event ini. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { exhibitorId, agentId } = patchSchema.parse(await request.json())
    const { client, workspaceId } = await getEventApiContext()

    const { data: exhibitor, error: exhibitorError } = await client
      .from('exhibitors')
      .select('id, payload')
      .eq('workspace_id', workspaceId)
      .eq('event_id', params.eventId)
      .eq('id', exhibitorId)
      .maybeSingle<{ id: string; payload: Record<string, unknown> | null }>()
    if (exhibitorError) throw exhibitorError
    if (!exhibitor) throw new Error('Exhibitor tidak ditemukan.')

    if (agentId) {
      const { data: participation, error: participationError } = await client
        .from('event_agents')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('event_id', params.eventId)
        .eq('agent_id', agentId)
        .maybeSingle<{ id: string }>()
      if (participationError) throw participationError
      if (!participation) throw new Error('Agent belum terdaftar di event ini.')
    }

    const { data, error } = await client
      .from('exhibitors')
      .update({
        agent_id: agentId,
        payload: { ...(exhibitor.payload ?? {}), agentId },
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('id', exhibitorId)
      .select('id, event_id, name, kind, contact, agent_id, npwp, created_at, created_by_id, updated_at')
      .single()
    if (error) throw error

    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return eventApiFailure(error)
  }
}
