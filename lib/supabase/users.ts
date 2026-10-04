import 'server-only'
import { verifyPassword } from '@/lib/auth/password'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type DatabaseUser = {
  id: string
  email: string
  full_name: string
  is_admin: boolean
  is_active: boolean
  password_hash: string
}

export async function authenticateDatabaseUser(email: string, password: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('app_users')
    .select('id, email, full_name, is_admin, is_active, password_hash')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle<DatabaseUser>()
  if (error) throw new Error(`Akun tidak dapat dimuat: ${error.message}`)
  if (!data?.is_active || !(await verifyPassword(password, data.password_hash))) return null
  return { id: data.id, name: data.full_name, email: data.email, isAdmin: data.is_admin }
}
