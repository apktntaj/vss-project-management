import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { exhibitorLogisticsSchema } from '@/domain/job/manifest'
import { eventApiFailure, getEventApiContext } from '@/lib/supabase/event-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

const putSchema = z.object({
  exhibitorId: z.string().min(1),
  logistics: exhibitorLogisticsSchema,
})

/** Menyimpan data fisik kepesertaan (hall, booth, koli, catatan) pada payload exhibitor event ini. */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { exhibitorId, logistics } = putSchema.parse(await request.json())
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

    const { data, error } = await client
      .from('exhibitors')
      .update({
        payload: { ...(exhibitor.payload ?? {}), logistics },
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('id', exhibitorId)
      .select('payload')
      .single<{ payload: Record<string, unknown> | null }>()
    if (error) throw error

    const stored = (data.payload as { logistics?: unknown } | null)?.logistics
    return NextResponse.json(stored ?? logistics, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return eventApiFailure(error)
  }
}
