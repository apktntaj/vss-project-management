import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/auth'
import {
  eventInputSchema,
  eventOrganizerInputSchema,
  exhibitorInputSchema,
  venueInputSchema,
} from '@/domain/event/validation'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Resource = 'venues' | 'event-organizers' | 'events' | 'exhibitors'
const resources: readonly Resource[] = ['venues', 'event-organizers', 'events', 'exhibitors']

function resourceFrom(value: string | null): Resource | null {
  return value && resources.includes(value as Resource) ? value as Resource : null
}

async function context() {
  const session = await auth()
  if (!session?.user?.email) throw new Error('Autentikasi diperlukan.')
  const client = getSupabaseAdmin()
  const [{ data: workspace, error: workspaceError }, { data: user, error: userError }] = await Promise.all([
    client.from('workspaces').select('id').eq('slug', 'default').single<{ id: string }>(),
    client.from('app_users').select('id').eq('email', session.user.email).single<{ id: string }>(),
  ])
  if (workspaceError || !workspace) throw new Error(`Workspace tidak dapat dimuat: ${workspaceError?.message ?? 'tidak ditemukan'}`)
  if (userError || !user) throw new Error(`User tidak dapat dimuat: ${userError?.message ?? 'tidak ditemukan'}`)
  return { client, workspaceId: workspace.id, userId: user.id }
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Data event tidak dapat diproses.'
  return NextResponse.json({ error: message }, { status: message === 'Autentikasi diperlukan.' ? 401 : 400 })
}

export async function GET(request: NextRequest) {
  const resource = resourceFrom(request.nextUrl.searchParams.get('resource'))
  if (!resource) return NextResponse.json({ error: 'Resource tidak valid.' }, { status: 400 })
  try {
    const { client, workspaceId } = await context()
    if (resource === 'events') {
      const [eventsResult, venuesResult, organizersResult, cancellationsResult] = await Promise.all([
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
      ])
      const error =
        eventsResult.error ??
        venuesResult.error ??
        organizersResult.error ??
        cancellationsResult.error
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
      return NextResponse.json(
        (eventsResult.data ?? []).map((event) => ({
          ...event,
          venues: venues.get(event.venue_id) ?? null,
          event_organizers: organizers.get(event.event_organizer_id) ?? null,
          event_cancellations: cancellations.get(event.id) ?? null,
        })),
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const query = client.from(resource === 'event-organizers' ? 'event_organizers' : resource)
    const { data, error } = await query.select('*').eq('workspace_id', workspaceId).order('name')
    if (error) throw error
    const eventId = request.nextUrl.searchParams.get('eventId')
    return NextResponse.json(resource === 'exhibitors' && eventId ? (data ?? []).filter((row) => row.event_id === eventId) : data ?? [], { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: NextRequest) {
  const resource = resourceFrom(request.nextUrl.searchParams.get('resource'))
  if (!resource) return NextResponse.json({ error: 'Resource tidak valid.' }, { status: 400 })
  try {
    const body = await request.json()
    const { client, workspaceId, userId } = await context()
    const id = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    if (resource === 'venues') {
      const input = venueInputSchema.parse(body)
      const row = { workspace_id: workspaceId, id, ...toSnake(input), created_at: timestamp, updated_at: timestamp, payload: input }
      const { error } = await client.from('venues').insert(row)
      if (error) throw error
      return NextResponse.json({ id, ...input, createdAt: timestamp, updatedAt: timestamp })
    }
    if (resource === 'event-organizers') {
      const input = eventOrganizerInputSchema.parse(body)
      const row = { workspace_id: workspaceId, id, ...toSnake(input), created_at: timestamp, updated_at: timestamp, payload: input }
      const { error } = await client.from('event_organizers').insert(row)
      if (error) throw error
      return NextResponse.json({ id, ...input, createdAt: timestamp, updatedAt: timestamp })
    }
    if (resource === 'events') {
      const input = eventInputSchema.parse(body)
      const { error } = await client.from('events').insert({ workspace_id: workspaceId, id, name: input.name, venue_id: input.venueId, event_organizer_id: input.eventOrganizerId, starts_on: input.startsOn, ends_on: input.endsOn, created_by_id: userId, created_at: timestamp, updated_at: timestamp, payload: input })
      if (error) throw error
      return NextResponse.json({ id, ...input, createdAt: timestamp, createdById: userId, cancellation: null })
    }
    const eventId = typeof body.eventId === 'string' ? body.eventId : ''
    const input = exhibitorInputSchema.parse(body)
    const { error } = await client.from('exhibitors').insert({ workspace_id: workspaceId, id, event_id: eventId, name: input.name, kind: input.kind, contact: input.contact, agent_id: input.agentId, npwp: input.kind === 'LOCAL' ? input.npwp : null, created_by_id: userId, created_at: timestamp, updated_at: timestamp, payload: input })
    if (error) throw error
    return NextResponse.json({ id, eventId, ...input, createdAt: timestamp, createdById: userId, updatedAt: timestamp })
  } catch (error) {
    return failure(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { client, workspaceId, userId } = await context()
    const eventId = request.nextUrl.searchParams.get('eventId')
    const reason = request.nextUrl.searchParams.get('reason')?.trim()
    if (!eventId || !reason) return NextResponse.json({ error: 'Event dan alasan pembatalan wajib diisi.' }, { status: 400 })
    const { error } = await client.from('event_cancellations').insert({ workspace_id: workspaceId, event_id: eventId, reason, cancelled_by_id: userId })
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return failure(error)
  }
}

function toSnake<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), item]))
}
