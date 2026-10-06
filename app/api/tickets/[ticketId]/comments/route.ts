import { NextRequest, NextResponse } from 'next/server'
import { ticketCommentSchema } from '@/domain/ticket/validation'
import { getTicketApiContext, ticketApiFailure, toComment } from '@/lib/supabase/ticket-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { ticketId: string } }) {
  try {
    const { body } = ticketCommentSchema.parse(await request.json())
    const { client, workspaceId, userId } = await getTicketApiContext()
    const { data: ticket, error: ticketError } = await client.from('tickets').select('id').eq('workspace_id', workspaceId).eq('id', params.ticketId).maybeSingle()
    if (ticketError) throw ticketError
    if (!ticket) throw new Error('Ticket tidak ditemukan.')
    const { data, error } = await client.from('ticket_comments').insert({ workspace_id: workspaceId, ticket_id: params.ticketId, author_id: userId, body: body.trim() }).select().single()
    if (error) throw error
    return NextResponse.json(toComment(data), { status: 201 })
  } catch (error) {
    return ticketApiFailure(error)
  }
}
