import { NextRequest, NextResponse } from 'next/server'

import { eventApiFailure, getEventApiContext } from '@/lib/supabase/event-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const body = await request.json().catch(() => null) as { reason?: unknown } | null
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    if (!reason) {
      return NextResponse.json({ error: 'Alasan pembatalan wajib diisi.' }, { status: 400 })
    }

    const { client, workspaceId, userId } = await getEventApiContext()
    const { data: event, error: eventError } = await client
      .from('events')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('id', params.eventId)
      .single<{ id: string }>()
    if (eventError || !event) throw new Error('Event tidak ditemukan.')

    const { error } = await client.from('event_cancellations').insert({
      workspace_id: workspaceId,
      event_id: params.eventId,
      reason,
      cancelled_by_id: userId,
    })
    if (error) throw error

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return eventApiFailure(error)
  }
}
