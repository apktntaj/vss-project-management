import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terlebih dahulu.')

const venues = [
  { legal_name: 'Jakarta International Expo (JIEXPO)', alias_name: 'JIEXPO Kemayoran', city: 'Jakarta' },
  { legal_name: 'Jakarta Convention Center', alias_name: 'JCC', city: 'Jakarta' },
  { legal_name: 'Indonesia Convention Exhibition', alias_name: 'ICE BSD City', city: 'Tangerang' },
]
const organizers = [
  { legal_name: 'PT Dyandra Promosindo' },
  { legal_name: 'PT Pamerindo Indonesia' },
  { legal_name: 'PT Deka Event Indonesia' },
  { legal_name: 'PT Jakarta International Expo' },
]

async function seedByName(client: SupabaseClient, workspaceId: string, table: 'venues' | 'event_organizers', rows: Record<string, unknown>[]) {
  for (const row of rows) {
    const { data: existing, error: findError } = await client.from(table).select('id').eq('workspace_id', workspaceId).eq('legal_name', row.legal_name as string).maybeSingle<{ id: string }>()
    if (findError) throw new Error(`${table} tidak dapat diperiksa: ${findError.message}`)
    if (existing) continue
    const { error: insertError } = await client.from(table).insert({ workspace_id: workspaceId, ...row })
    if (insertError) throw new Error(`${table} tidak dapat disimpan: ${insertError.message}`)
  }
}

async function main() {
  const client = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: workspace, error: workspaceError } = await client.from('workspaces').select('id').eq('slug', 'default').single<{ id: string }>()
  if (workspaceError || !workspace) throw new Error(`Workspace default tidak ditemukan: ${workspaceError?.message ?? ''}`)
  await seedByName(client, workspace.id, 'venues', venues)
  await seedByName(client, workspace.id, 'event_organizers', organizers)
  const [venueCheck, organizerCheck] = await Promise.all([
    client.from('venues').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
    client.from('event_organizers').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
  ])
  if (venueCheck.error || organizerCheck.error) throw new Error('Verifikasi seed gagal.')
  console.log(`${venueCheck.count} venue dan ${organizerCheck.count} EO ada di workspace default.`)
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
