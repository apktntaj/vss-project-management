import { z } from 'zod'
import { hashPassword } from '../lib/auth/password'
import { getSupabaseAdmin, isSupabaseConfigured } from '../lib/supabase/admin'

const input = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  role: z.enum(['STAFF', 'SUPERVISOR', 'CUSTOMER_SERVICE', 'DOCUMENT_ASSISTANT']).default('STAFF'),
  admin: z.enum(['true', 'false']).default('false'),
})

async function main() {
  if (!isSupabaseConfigured()) throw new Error('Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terlebih dahulu.')
  const password = process.env.VSS_USER_PASSWORD
  if (!password || password.length < 12) throw new Error('Isi VSS_USER_PASSWORD (minimal 12 karakter); jangan taruh password di argumen CLI.')
  const parsed = input.parse({ email: process.argv[2], name: process.argv[3], role: process.argv[4] ?? 'STAFF', admin: process.argv[5] ?? 'false' })
  const { error } = await getSupabaseAdmin().from('app_users').insert({
    email: parsed.email, full_name: parsed.name, role: parsed.role, is_admin: parsed.admin === 'true', password_hash: await hashPassword(password),
  })
  if (error) throw new Error(`Akun tidak dapat dibuat: ${error.message}`)
  console.log(`Akun ${parsed.email} dibuat.`)
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
