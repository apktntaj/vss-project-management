import { z } from 'zod'
import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const input = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  role: z.enum(['STAFF', 'SUPERVISOR', 'CUSTOMER_SERVICE', 'DOCUMENT_ASSISTANT']).default('STAFF'),
  admin: z.enum(['true', 'false']).default('false'),
})

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terlebih dahulu.')
  const password = process.env.VSS_USER_PASSWORD
  if (!password || password.length < 12) throw new Error('Isi VSS_USER_PASSWORD (minimal 12 karakter); jangan taruh password di argumen CLI.')
  const parsed = input.parse({ email: process.argv[2], name: process.argv[3], role: process.argv[4] ?? 'STAFF', admin: process.argv[5] ?? 'false' })
  const { error } = await createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }).from('app_users').insert({
    email: parsed.email, full_name: parsed.name, role: parsed.role, is_admin: parsed.admin === 'true', password_hash: await hashPassword(password),
  })
  if (error) throw new Error(`Akun tidak dapat dibuat: ${error.message}`)
  console.log(`Akun ${parsed.email} dibuat.`)
}

async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = await new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, value) => error ? reject(error) : resolve(value)))
  return ['scrypt', 16_384, 8, 1, salt.toString('base64url'), hash.toString('base64url')].join('$')
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
