import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/features/auth'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { PasswordChangeSchema } from '@/domain/user/validation'
import { isSupabaseConfigured, getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const IdSchema = z.string().min(1)

export async function POST(request: NextRequest) {
  const session = await auth()
  const userId = IdSchema.safeParse(session?.user?.id)
  if (!userId.success) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })

  const parsed = PasswordChangeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Payload tidak valid.' }, { status: 400 })
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase wajib dikonfigurasi.' }, { status: 503 })

  const client = getSupabaseAdmin()
  const { data: row, error } = await client
    .from('app_users')
    .select('password_hash')
    .eq('id', userId.data)
    .maybeSingle<{ password_hash: string }>()
  if (error || !row) return NextResponse.json({ error: 'User tidak dapat dimuat.' }, { status: 503 })

  if (!(await verifyPassword(parsed.data.currentPassword, row.password_hash))) {
    return NextResponse.json({ error: 'Kata sandi saat ini tidak cocok.' }, { status: 400 })
  }

  const { error: updateError } = await client
    .from('app_users')
    .update({ password_hash: await hashPassword(parsed.data.newPassword) })
    .eq('id', userId.data)
  if (updateError) return NextResponse.json({ error: `Kata sandi tidak dapat diperbarui: ${updateError.message}` }, { status: 503 })

  return NextResponse.json({ ok: true })
}
