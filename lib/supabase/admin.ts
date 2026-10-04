import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Server-only client; its service-role key must never reach a browser. */
export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

let client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib dikonfigurasi.')
  }
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return client
}
