import { NextRequest, NextResponse } from 'next/server'

import { eventInputSchema } from '@/domain/event/validation'
import { eventApiFailure, getEventApiContext } from '@/lib/supabase/event-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const input = eventInputSchema.parse(await request.json())
    const { client, workspaceId } = await getEventApiContext()
    const timestamp = new Date().toISOString()
    const { data, error } = await client
      .from('events')
      .update({
        name: input.name,
        venue_id: input.venueId,
        event_organizer_id: input.eventOrganizerId,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
        updated_at: timestamp,
        payload: input,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', params.eventId)
      .select('id')
      .maybeSingle<{ id: string }>()
    if (error) throw error
    if (!data) throw new Error('Event tidak ditemukan.')

    return NextResponse.json(
      { id: data.id, ...input },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return eventApiFailure(error)
  }
}

// Hapus permanen event beserta rekam operasional yang terikat padanya.
// Tabel tanpa FK dihapus lewat filter payload; urutannya anak sebelum induk.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { client, workspaceId } = await getEventApiContext()
    const { data: existing, error: existingError } = await client
      .from('events')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('id', params.eventId)
      .maybeSingle<{ id: string }>()
    if (existingError) throw existingError
    if (!existing) throw new Error('Event tidak ditemukan.')

    const { data: eventJobs, error: jobsError } = await client
      .from('jobs')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('payload->>eventId', params.eventId)
    if (jobsError) throw jobsError
    const jobIds = (eventJobs ?? []).map((job) => String(job.id))

    const { data: eventExhibitors, error: exhibitorsError } = await client
      .from('exhibitors')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('event_id', params.eventId)
    if (exhibitorsError) throw exhibitorsError
    const exhibitorIds = (eventExhibitors ?? []).map((exhibitor) => String(exhibitor.id))

    let ciplIds: string[] = []
    if (exhibitorIds.length) {
      const { data, error } = await client
        .from('cipls')
        .select('id')
        .eq('workspace_id', workspaceId)
        .in('payload->>exhibitorId', exhibitorIds)
      if (error) throw error
      ciplIds = (data ?? []).map((cipl) => String(cipl.id))
    }

    const deleteByPayload = async (table: string, column: string, values: string[]) => {
      if (!values.length) return
      const { error } = await client
        .from(table)
        .delete()
        .eq('workspace_id', workspaceId)
        .in(`payload->>${column}`, values)
      if (error) throw error
    }
    await deleteByPayload('job_stages', 'jobId', jobIds)
    await deleteByPayload('job_documents', 'jobId', jobIds)
    await deleteByPayload('shipments', 'jobId', jobIds)
    await deleteByPayload('customs_jobs', 'jobId', jobIds)
    await deleteByPayload('jobs', 'eventId', [params.eventId])
    await deleteByPayload('cipl_versions', 'ciplId', ciplIds)
    await deleteByPayload('cipls', 'exhibitorId', exhibitorIds)

    const { error: eventTicketsError } = await client
      .from('tickets')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('context_kind', 'EVENT')
      .eq('context_id', params.eventId)
    if (eventTicketsError) throw eventTicketsError
    if (jobIds.length) {
      const { error } = await client
        .from('tickets')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('context_kind', 'JOB')
        .in('context_id', jobIds)
      if (error) throw error
    }

    const { error: exhibitorsDeleteError } = await client
      .from('exhibitors')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('event_id', params.eventId)
    if (exhibitorsDeleteError) throw exhibitorsDeleteError
    await client.from('event_cancellations').delete().eq('workspace_id', workspaceId).eq('event_id', params.eventId)
    await client.from('event_agents').delete().eq('workspace_id', workspaceId).eq('event_id', params.eventId)

    const { error: deleteError } = await client
      .from('events')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', params.eventId)
    if (deleteError) throw deleteError

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return eventApiFailure(error)
  }
}
