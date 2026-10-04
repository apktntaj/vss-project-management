import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/auth'
import { hashPassword } from '@/lib/auth/password'
import { UserSchema } from '@/domain/user/validation'
import { eventOrganizerInputSchema, venueInputSchema } from '@/domain/event/validation'
import { isSupabaseConfigured, getSupabaseAdmin } from '@/lib/supabase/admin'
import { addDemoUser, listDemoUsers, updateDemoUser } from '@/lib/demo-users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const userUpdateSchema = UserSchema.extend({ password: z.string().min(1, 'Password wajib diisi.').optional() })
const resourceSchema = z.enum(['users', 'venues', 'organizers'])

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error('Autentikasi diperlukan.')
  if (!session.user.isAdmin) throw new Error('Hanya admin yang dapat mengelola pengaturan.')
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Pengaturan tidak dapat diproses.'
  return NextResponse.json({ error: message }, { status: message === 'Autentikasi diperlukan.' ? 401 : message.startsWith('Hanya admin') ? 403 : 400 })
}

export async function GET() {
  try {
    await requireAdmin()
    if (!isSupabaseConfigured()) return NextResponse.json({ users: listDemoUsers().map((user) => ({ ...user, id: user.email })), venues: [], organizers: [] })

    const client = getSupabaseAdmin()
    const [{ data: users, error: usersError }, { data: workspace, error: workspaceError }] = await Promise.all([
      client.from('app_users').select('id, full_name, email, job_role, access_level, is_active').order('full_name'),
      client.from('workspaces').select('id').eq('slug', 'default').single<{ id: string }>(),
    ])
    if (usersError) throw new Error(`Pengguna tidak dapat dimuat: ${usersError.message}`)
    if (workspaceError || !workspace) throw new Error(`Workspace tidak dapat dimuat: ${workspaceError?.message ?? 'tidak ditemukan'}`)
    const [{ data: venues, error: venuesError }, { data: organizers, error: organizersError }] = await Promise.all([
      client.from('venues').select('id, name, address, website, loading_access_notes').eq('workspace_id', workspace.id).order('name'),
      client.from('event_organizers').select('id, name, npwp, address, website').eq('workspace_id', workspace.id).order('name'),
    ])
    if (venuesError) throw new Error(`Venue tidak dapat dimuat: ${venuesError.message}`)
    if (organizersError) throw new Error(`Event organizer tidak dapat dimuat: ${organizersError.message}`)
    return NextResponse.json({
      users: (users ?? []).map((user) => ({ id: user.id, nama: user.full_name, email: user.email, jobRole: user.job_role, isAdmin: user.access_level === 'ADMIN', isActive: user.is_active })),
      venues: venues ?? [],
      organizers: organizers ?? [],
    })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const resource = resourceSchema.parse(body.resource)
    if (resource === 'users') {
      const input = UserSchema.parse(body.input)
      if (!isSupabaseConfigured()) {
        const result = addDemoUser(input)
        if (!result.ok) throw new Error(result.error)
        return NextResponse.json(result.user)
      }
      const { data, error } = await getSupabaseAdmin().from('app_users').insert({
        email: input.email, full_name: input.nama, role: 'STAFF', job_role: 'STAFF', is_admin: input.isAdmin, access_level: input.isAdmin ? 'ADMIN' : 'MEMBER', password_hash: await hashPassword(input.password),
      }).select('id, full_name, email, job_role, access_level, is_active').single()
      if (error) throw new Error(`Pengguna tidak dapat dibuat: ${error.message}`)
      return NextResponse.json({ id: data.id, nama: data.full_name, email: data.email, jobRole: data.job_role, isAdmin: data.access_level === 'ADMIN', isActive: data.is_active })
    }

    if (!isSupabaseConfigured()) throw new Error('Supabase wajib dikonfigurasi untuk mengelola venue dan event organizer.')
    const client = getSupabaseAdmin()
    const { data: workspace, error: workspaceError } = await client.from('workspaces').select('id').eq('slug', 'default').single<{ id: string }>()
    if (workspaceError || !workspace) throw new Error(`Workspace tidak dapat dimuat: ${workspaceError?.message ?? 'tidak ditemukan'}`)
    const timestamp = new Date().toISOString()
    if (resource === 'venues') {
      const input = venueInputSchema.parse(body.input)
      const { data, error } = await client.from('venues').insert({
        workspace_id: workspace.id, id: crypto.randomUUID(), ...input, created_at: timestamp, updated_at: timestamp, payload: input,
      }).select('id, name, address, website, loading_access_notes').single()
      if (error) throw new Error(`Venue tidak dapat dibuat: ${error.message}`)
      return NextResponse.json(data)
    }
    const input = eventOrganizerInputSchema.parse(body.input)
    const { data, error } = await client.from('event_organizers').insert({
      workspace_id: workspace.id, id: crypto.randomUUID(), ...input, created_at: timestamp, updated_at: timestamp, payload: input,
    }).select('id, name, npwp, address, website').single()
    if (error) throw new Error(`Event organizer tidak dapat dibuat: ${error.message}`)
    return NextResponse.json(data)
  } catch (error) {
    return failure(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const resource = resourceSchema.parse(body.resource)
    const id = z.string().min(1).parse(body.id)
    if (resource === 'users') {
      const input = userUpdateSchema.parse(body.input)
      if (!isSupabaseConfigured()) {
        const result = updateDemoUser(id, input)
        if (!result.ok) throw new Error(result.error)
        return NextResponse.json(result.user)
      }
      const update = { email: input.email, full_name: input.nama, is_admin: input.isAdmin, access_level: input.isAdmin ? 'ADMIN' : 'MEMBER', ...(input.password ? { password_hash: await hashPassword(input.password) } : {}) }
      const { data, error } = await getSupabaseAdmin().from('app_users').update(update).eq('id', id).select('id, full_name, email, job_role, access_level, is_active').single()
      if (error) throw new Error(`Pengguna tidak dapat diperbarui: ${error.message}`)
      return NextResponse.json({ id: data.id, nama: data.full_name, email: data.email, jobRole: data.job_role, isAdmin: data.access_level === 'ADMIN', isActive: data.is_active })
    }
    if (!isSupabaseConfigured()) throw new Error('Supabase wajib dikonfigurasi untuk mengelola venue dan event organizer.')
    const input = resource === 'venues' ? venueInputSchema.parse(body.input) : eventOrganizerInputSchema.parse(body.input)
    const table = resource === 'venues' ? 'venues' : 'event_organizers'
    const { data, error } = await getSupabaseAdmin().from(table).update({ ...input, payload: input, updated_at: new Date().toISOString() }).eq('id', id).select(resource === 'venues' ? 'id, name, address, website, loading_access_notes' : 'id, name, npwp, address, website').single()
    if (error) throw new Error(`${resource === 'venues' ? 'Venue' : 'Event organizer'} tidak dapat diperbarui: ${error.message}`)
    return NextResponse.json(data)
  } catch (error) {
    return failure(error)
  }
}
