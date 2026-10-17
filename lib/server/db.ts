import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Modul fondasi: satu-satunya titik pembuatan service-role Supabase client.
// `import 'server-only'` di atas adalah sabuk pengaman build-time — kunci service-role
// tidak boleh pernah ikut ke bundle browser (Req 3.2, Req 20.2).

const WORKSPACE_SLUG = 'default'

/**
 * Konteks workspace yang di-resolve: client service-role + id workspace aktif.
 * Mengikuti pola `workspaceId()`/`getEventApiContext()` — repository dan use-case
 * memakai keduanya untuk menyaring `workspace_id` pada setiap query (Req 5.4).
 */
export type WorkspaceContext = {
  client: SupabaseClient
  workspaceId: string
}

let serviceRoleClient: SupabaseClient | null = null

/** True bila kredensial service-role tersedia di environment server. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * Service-role Supabase client (lazy singleton). Memakai `SUPABASE_URL` dan
 * `SUPABASE_SERVICE_ROLE_KEY` — jangan pernah memberi prefix `NEXT_PUBLIC_` pada keduanya.
 */
export function getServiceRoleClient(): SupabaseClient {
  if (!isDatabaseConfigured()) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib dikonfigurasi.')
  }
  serviceRoleClient ??= createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  return serviceRoleClient
}

/**
 * Me-resolve workspace single-tenant lewat `slug = 'default'` dan mengembalikan konteks
 * (client + workspaceId). Setiap query entitas menyaring `workspace_id` dari konteks ini.
 */
export async function withWorkspace(): Promise<WorkspaceContext> {
  const client = getServiceRoleClient()
  const { data, error } = await client
    .from('workspaces')
    .select('id')
    .eq('slug', WORKSPACE_SLUG)
    .single<{ id: string }>()
  if (error || !data) {
    throw new Error(
      `Workspace tidak dapat dimuat: ${error?.message ?? 'tidak ditemukan'}`,
    )
  }
  return { client, workspaceId: data.id }
}
