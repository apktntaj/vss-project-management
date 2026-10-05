import { NextResponse } from 'next/server'

import { getEventApiContext } from '@/lib/supabase/event-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PayloadRow = { payload: Record<string, unknown> }
type ExhibitorRow = {
  id: string
  event_id: string
  name: string
  kind: 'LOCAL' | 'INTERNATIONAL'
  contact: Record<string, unknown> | null
  agent_id: string | null
  npwp: string | null
  created_at: string
  created_by_id: string
  updated_at: string
}

function initializeJob(exhibitor: ExhibitorRow, jobNumber: string, timestamp: string) {
  return {
    id: `job-for-exhibitor-${exhibitor.id}`,
    jobNumber,
    awbNumber: null,
    blNumber: null,
    shipper: exhibitor.name,
    consignee: null,
    notifyParty: null,
    agent: null,
    shippingLine: null,
    cargoDescription: null,
    shipmentMode: null,
    cargoDetails: null,
    journeyDetails: null,
    type: 'IMPORT',
    clientName: exhibitor.name,
    clientInfo: null,
    status: 'DRAFT',
    notes: null,
    trackingToken: crypto.randomUUID(),
    assignedToId: null,
    createdById: null,
    eventId: exhibitor.event_id,
    exhibitorId: exhibitor.id,
    sourceDocumentName: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    stages: [],
    documents: [],
  }
}

export async function GET() {
  try {
    const { client, workspaceId } = await getEventApiContext()
    const [
      jobsResult,
      stagesResult,
      usersResult,
      documentsResult,
      exhibitorsResult,
      eventsResult,
      venuesResult,
      organizersResult,
      cancellationsResult,
    ] = await Promise.all([
      client.from('jobs').select('payload').eq('workspace_id', workspaceId),
      client.from('job_stages').select('payload').eq('workspace_id', workspaceId),
      client
        .from('app_users')
        .select('id, full_name, email, job_role, access_level, is_active, created_at, updated_at')
        .order('full_name'),
      client.from('job_documents').select('payload').eq('workspace_id', workspaceId),
      client
        .from('exhibitors')
        .select('id, event_id, name, kind, contact, agent_id, npwp, created_at, created_by_id, updated_at')
        .eq('workspace_id', workspaceId)
        .order('name'),
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
      jobsResult.error ??
      stagesResult.error ??
      usersResult.error ??
      documentsResult.error ??
      exhibitorsResult.error ??
      eventsResult.error ??
      venuesResult.error ??
      organizersResult.error ??
      cancellationsResult.error
    if (error) throw error

    const jobs = (jobsResult.data ?? []).map((row: PayloadRow) => row.payload)
    const exhibitors = (exhibitorsResult.data ?? []) as ExhibitorRow[]
    const linkedExhibitorIds = new Set(
      jobs.flatMap((job) =>
        typeof job.exhibitorId === 'string' ? [job.exhibitorId] : [],
      ),
    )
    const missingExhibitors = exhibitors.filter(
      (exhibitor) => !linkedExhibitorIds.has(exhibitor.id),
    )

    if (missingExhibitors.length) {
      const usedNumbers = new Set(
        jobs.flatMap((job) => (typeof job.jobNumber === 'string' ? [job.jobNumber] : [])),
      )
      let sequence = jobs.length + 1
      const timestamp = new Date().toISOString()
      const newJobs = missingExhibitors.map((exhibitor) => {
        let jobNumber = `VSS-${String(sequence++).padStart(4, '0')}`
        while (usedNumbers.has(jobNumber)) {
          jobNumber = `VSS-${String(sequence++).padStart(4, '0')}`
        }
        usedNumbers.add(jobNumber)
        return initializeJob(exhibitor, jobNumber, timestamp)
      })
      const { error: insertError } = await client.from('jobs').upsert(
        newJobs.map((job) => ({
          workspace_id: workspaceId,
          id: job.id,
          payload: job,
          updated_at: timestamp,
        })),
        { onConflict: 'workspace_id,id' },
      )
      if (insertError) throw insertError
      jobs.push(...newJobs)
    }

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
      {
        jobs,
        stages: (stagesResult.data ?? []).map((row: PayloadRow) => row.payload),
        users: (usersResult.data ?? []).map((user) => ({
          id: user.id,
          name: user.full_name,
          email: user.email,
          jobRole: user.job_role,
          accessLevel: user.access_level,
          isActive: user.is_active,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        })),
        documents: (documentsResult.data ?? []).map((row: PayloadRow) => row.payload),
        exhibitors,
        events: (eventsResult.data ?? []).map((event) => ({
          ...event,
          venues: venues.get(event.venue_id) ?? null,
          event_organizers: organizers.get(event.event_organizer_id) ?? null,
          event_cancellations: cancellations.get(event.id) ?? null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Data jobs tidak dapat dimuat.'
    return NextResponse.json(
      { error: message },
      { status: message === 'Autentikasi diperlukan.' ? 401 : 503 },
    )
  }
}
