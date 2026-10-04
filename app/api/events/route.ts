import { NextRequest, NextResponse } from 'next/server'

import { eventInputSchema } from '@/domain/event/validation'
import { eventApiFailure, getEventApiContext } from '@/lib/supabase/event-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { client, workspaceId } = await getEventApiContext()
    const [
      eventsResult,
      venuesResult,
      organizersResult,
      cancellationsResult,
      exhibitorsResult,
    ] = await Promise.all([
      client
        .from('events')
        .select('id, name, venue_id, event_organizer_id, starts_on, ends_on, created_at, created_by_id')
        .eq('workspace_id', workspaceId)
        .order('starts_on'),
      client
        .from('venues')
        .select('id, name, contacts, address, website, loading_access_notes, created_at, updated_at')
        .eq('workspace_id', workspaceId),
      client
        .from('event_organizers')
        .select('id, name, npwp, contacts, address, website, created_at, updated_at')
        .eq('workspace_id', workspaceId),
      client
        .from('event_cancellations')
        .select('event_id, reason, cancelled_at, cancelled_by_id')
        .eq('workspace_id', workspaceId),
      client
        .from('exhibitors')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('name'),
    ])

    const error =
      eventsResult.error ??
      venuesResult.error ??
      organizersResult.error ??
      cancellationsResult.error ??
      exhibitorsResult.error
    if (error) throw error

    const venues = new Map((venuesResult.data ?? []).map((venue) => [venue.id, venue]))
    const organizers = new Map(
      (organizersResult.data ?? []).map((organizer) => [organizer.id, organizer]),
    )
    const cancellations = new Map(
      (cancellationsResult.data ?? []).map((cancellation) => [
        cancellation.event_id,
        cancellation,
      ]),
    )
    const exhibitorsByEvent = new Map<string, typeof exhibitorsResult.data>()
    for (const exhibitor of exhibitorsResult.data ?? []) {
      const exhibitors = exhibitorsByEvent.get(exhibitor.event_id) ?? []
      exhibitors.push(exhibitor)
      exhibitorsByEvent.set(exhibitor.event_id, exhibitors)
    }

    return NextResponse.json(
      (eventsResult.data ?? []).map((event) => ({
        ...event,
        venues: venues.get(event.venue_id) ?? null,
        event_organizers: organizers.get(event.event_organizer_id) ?? null,
        event_cancellations: cancellations.get(event.id) ?? null,
        exhibitors: exhibitorsByEvent.get(event.id) ?? [],
      })),
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return eventApiFailure(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = eventInputSchema.parse(await request.json())
    const { client, workspaceId, userId } = await getEventApiContext()
    const id = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const { error } = await client.from('events').insert({
      workspace_id: workspaceId,
      id,
      name: input.name,
      venue_id: input.venueId,
      event_organizer_id: input.eventOrganizerId,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      created_by_id: userId,
      created_at: timestamp,
      updated_at: timestamp,
      payload: input,
    })
    if (error) throw error

    return NextResponse.json({
      id,
      ...input,
      createdAt: timestamp,
      createdById: userId,
      cancellation: null,
    })
  } catch (error) {
    return eventApiFailure(error)
  }
}
