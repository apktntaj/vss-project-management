import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/auth'
import { eventOrganizerInputSchema, venueInputSchema } from '@/domain/event/validation'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Resource = 'venues' | 'event-organizers'
const resources: readonly Resource[] = ['venues', 'event-organizers']

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
    const query = client.from(resource === 'event-organizers' ? 'event_organizers' : 'venues')
    const { data, error } = await query.select('*').eq('workspace_id', workspaceId).order('name')
    if (error) throw error
    return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
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
  } catch (error) {
    return failure(error)
  }
}


function toSnake<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), item]))
}
