import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/features/auth'
import { hashPassword } from '@/lib/auth/password'
import { UserSchema } from '@/domain/user/validation'
import { referenceEventOrganizerInputSchema, referenceVenueInputSchema } from '@/domain/event/validation'
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
  return session
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
    // Skema redesign: venues/legal_name+alias_name+city, event_organizers/legal_name (lihat
    // migration 20261101020000). Respons dipetakan snake→camel agar konsisten dengan VenueRecord.
    const [{ data: venues, error: venuesError }, { data: organizers, error: organizersError }] = await Promise.all([
      client.from('venues').select('id, legal_name, alias_name, city').eq('workspace_id', workspace.id).order('legal_name'),
      client.from('event_organizers').select('id, legal_name').eq('workspace_id', workspace.id).order('legal_name'),
    ])
    if (venuesError) throw new Error(`Venue tidak dapat dimuat: ${venuesError.message}`)
    if (organizersError) throw new Error(`Event organizer tidak dapat dimuat: ${organizersError.message}`)
    return NextResponse.json({
      users: (users ?? []).map((user) => ({ id: user.id, nama: user.full_name, email: user.email, jobRole: user.job_role, isAdmin: user.access_level === 'ADMIN', isActive: user.is_active })),
      venues: (venues ?? []).map((venue) => ({ id: venue.id, legalName: venue.legal_name, aliasName: venue.alias_name, city: venue.city })),
      organizers: (organizers ?? []).map((organizer) => ({ id: organizer.id, legalName: organizer.legal_name })),
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
      const { data: workspace, error: workspaceError } = await getSupabaseAdmin().from('workspaces').select('id').eq('slug', 'default').single<{ id: string }>()
      if (workspaceError || !workspace) throw new Error('Workspace tidak dapat dimuat: user dibuat tanpa keanggotaan workspace.')
      const { error: memberError } = await getSupabaseAdmin().from('workspace_members').insert({ workspace_id: workspace.id, user_id: data.id, role: 'MEMBER' })
      if (memberError) throw new Error(`Keanggotaan workspace tidak dapat dibuat: ${memberError.message}`)
      return NextResponse.json({ id: data.id, nama: data.full_name, email: data.email, jobRole: data.job_role, isAdmin: data.access_level === 'ADMIN', isActive: data.is_active })
    }

    if (!isSupabaseConfigured()) throw new Error('Supabase wajib dikonfigurasi untuk mengelola venue dan event organizer.')
    const client = getSupabaseAdmin()
    const { data: workspace, error: workspaceError } = await client.from('workspaces').select('id').eq('slug', 'default').single<{ id: string }>()
    if (workspaceError || !workspace) throw new Error(`Workspace tidak dapat dimuat: ${workspaceError?.message ?? 'tidak ditemukan'}`)
    if (resource === 'venues') {
      const input = referenceVenueInputSchema.parse(body.input)
      const { data, error } = await client.from('venues').insert({
        workspace_id: workspace.id, legal_name: input.legalName, alias_name: input.aliasName, city: input.city,
      }).select('id, legal_name, alias_name, city').single()
      if (error || !data) throw new Error(`Venue tidak dapat dibuat: ${error?.message ?? 'tidak ada data'}`)
      return NextResponse.json({ id: data.id, legalName: data.legal_name, aliasName: data.alias_name, city: data.city })
    }
    const input = referenceEventOrganizerInputSchema.parse(body.input)
    const { data, error } = await client.from('event_organizers').insert({
      workspace_id: workspace.id, legal_name: input.legalName,
    }).select('id, legal_name').single()
    if (error || !data) throw new Error(`Event organizer tidak dapat dibuat: ${error?.message ?? 'tidak ada data'}`)
    return NextResponse.json({ id: data.id, legalName: data.legal_name })
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
    if (resource === 'venues') {
      const input = referenceVenueInputSchema.parse(body.input)
      const { data, error } = await getSupabaseAdmin().from('venues').update({
        legal_name: input.legalName, alias_name: input.aliasName, city: input.city, updated_at: new Date().toISOString(),
      }).eq('id', id).select('id, legal_name, alias_name, city').single()
      if (error || !data) throw new Error(`Venue tidak dapat diperbarui: ${error?.message ?? 'tidak ditemukan'}`)
      return NextResponse.json({ id: data.id, legalName: data.legal_name, aliasName: data.alias_name, city: data.city })
    }
    const input = referenceEventOrganizerInputSchema.parse(body.input)
    const { data, error } = await getSupabaseAdmin().from('event_organizers').update({
      legal_name: input.legalName, updated_at: new Date().toISOString(),
    }).eq('id', id).select('id, legal_name').single()
    if (error || !data) throw new Error(`Event organizer tidak dapat diperbarui: ${error?.message ?? 'tidak ditemukan'}`)
    return NextResponse.json({ id: data.id, legalName: data.legal_name })
  } catch (error) {
    return failure(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdmin()
    const body = await request.json()
    const resource = resourceSchema.parse(body.resource)
    const id = z.string().min(1).parse(body.id)
    if (resource !== 'users') throw new Error('Hanya user yang dapat dihapus.')
    if (!isSupabaseConfigured()) throw new Error('Penghapusan user memerlukan Supabase.')
    if (session.user.id === id) throw new Error('Akun sendiri tidak dapat dihapus.')
    const client = getSupabaseAdmin()
    const { count } = await client.from('events').select('id', { count: 'exact', head: true }).eq('pic_id', id)
    if (count && count > 0) throw new Error(`User masih PIC dari ${count} event — ganti PIC event tersebut terlebih dahulu.`)
    const { error } = await client.from('app_users').delete().eq('id', id)
    if (error) {
      if (error.code === '23503') throw new Error('User masih dirujuk data lain (mis. pembuat event atau penulis komentar) sehingga tidak dapat dihapus.')
      throw new Error(`User tidak dapat dihapus: ${error.message}`)
    }
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return failure(error)
  }
}
