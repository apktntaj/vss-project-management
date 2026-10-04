import 'server-only'

import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function getEventApiContext() {
  const session = await auth()
  if (!session?.user?.email) throw new Error('Autentikasi diperlukan.')

  const client = getSupabaseAdmin()
  const [{ data: workspace, error: workspaceError }, { data: user, error: userError }] =
    await Promise.all([
      client.from('workspaces').select('id').eq('slug', 'default').single<{ id: string }>(),
      client.from('app_users').select('id').eq('email', session.user.email).single<{ id: string }>(),
    ])

  if (workspaceError || !workspace) {
    throw new Error(`Workspace tidak dapat dimuat: ${workspaceError?.message ?? 'tidak ditemukan'}`)
  }
  if (userError || !user) {
    throw new Error(`User tidak dapat dimuat: ${userError?.message ?? 'tidak ditemukan'}`)
  }

  return { client, workspaceId: workspace.id, userId: user.id }
}

export function eventApiFailure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Data event tidak dapat diproses.'
  return NextResponse.json(
    { error: message },
    { status: message === 'Autentikasi diperlukan.' ? 401 : 400 },
  )
}
