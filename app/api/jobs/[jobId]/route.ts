import { NextRequest, NextResponse } from 'next/server'

import { eventApiFailure, getEventApiContext } from '@/lib/supabase/event-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

// Hapus permanen job beserta rekam operasional yang terikat padanya.
// Tabel tanpa FK dihapus lewat filter payload; urutannya anak sebelum induk.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { client, workspaceId } = await getEventApiContext()
    const { data: existing, error: existingError } = await client
      .from('jobs')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('id', params.jobId)
      .maybeSingle<{ id: string }>()
    if (existingError) throw existingError
    if (!existing) throw new Error('Job tidak ditemukan.')

    const deleteByPayload = async (table: string, values: string[]) => {
      if (!values.length) return
      const { error } = await client
        .from(table)
        .delete()
        .eq('workspace_id', workspaceId)
        .in('payload->>jobId', values)
      if (error) throw error
    }
    await deleteByPayload('job_stages', [params.jobId])
    await deleteByPayload('job_documents', [params.jobId])
    await deleteByPayload('shipments', [params.jobId])
    await deleteByPayload('customs_jobs', [params.jobId])

    const { error: ticketsError } = await client
      .from('tickets')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('context_kind', 'JOB')
      .eq('context_id', params.jobId)
    if (ticketsError) throw ticketsError

    const { error: deleteError } = await client
      .from('jobs')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', params.jobId)
    if (deleteError) throw deleteError

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return eventApiFailure(error)
  }
}
