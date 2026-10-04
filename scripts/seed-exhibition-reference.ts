import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terlebih dahulu.')

const now = new Date().toISOString()
const venues = [
  { id: 'venue-jiexpo-kemayoran', officialName: 'Jakarta International Expo (JIEXPO)', aliasName: 'JIEXPO Kemayoran', address: 'Arena JIEXPO Kemayoran, Jakarta Pusat 10620, Indonesia', latitude: null, longitude: null, contactInfo: 'marketingvenue@jiexpo.com · +62 21 26645-000', createdAt: now, updatedAt: now },
  { id: 'venue-jakarta-convention-center', officialName: 'Jakarta Convention Center', aliasName: 'JCC', address: 'Jl. Jend. Gatot Subroto, Senayan, Jakarta, Indonesia', latitude: null, longitude: null, contactInfo: 'https://www.jcc.co.id/', createdAt: now, updatedAt: now },
  { id: 'venue-ice-bsd', officialName: 'Indonesia Convention Exhibition', aliasName: 'ICE BSD City', address: 'BSD City, Tangerang, Banten, Indonesia', latitude: null, longitude: null, contactInfo: '+62 21 2971 4600 · https://ice-indonesia.com/', createdAt: now, updatedAt: now },
]
const organizers = [
  { id: 'eo-dyandra-promosindo', legalName: 'PT Dyandra Promosindo', aliasName: 'Dyandra Promosindo', contactInfo: 'https://dyandra.com/', createdAt: now, updatedAt: now },
  { id: 'eo-pamerindo-indonesia', legalName: 'PT Pamerindo Indonesia', aliasName: 'Pamerindo Indonesia', contactInfo: 'https://www.pamerindo.com/', createdAt: now, updatedAt: now },
  { id: 'eo-deka-event-indonesia', legalName: 'PT Deka Event Indonesia', aliasName: 'Deka Event Indonesia', contactInfo: 'hello@deka.official.id · +62 21 7267910', createdAt: now, updatedAt: now },
  { id: 'eo-jiexpo', legalName: 'PT Jakarta International Expo', aliasName: 'JIEXPO', contactInfo: 'https://exhibition.jiexpo.com/', createdAt: now, updatedAt: now },
]

async function main() {
  const client = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: workspace, error: workspaceError } = await client.from('workspaces').select('id').eq('slug', 'default').single<{ id: string }>()
  if (workspaceError || !workspace) throw new Error(`Workspace default tidak ditemukan: ${workspaceError?.message ?? ''}`)
  for (const [table, rows] of [['venues', venues], ['event_organizers', organizers]] as const) {
    const { error } = await client.from(table).upsert(rows.map((payload) => ({ workspace_id: workspace.id, id: payload.id, payload, updated_at: now })), { onConflict: 'workspace_id,id' })
    if (error) throw new Error(`${table} tidak dapat disimpan: ${error.message}`)
  }
  const [venueCheck, organizerCheck] = await Promise.all([
    client.from('venues').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id).in('id', venues.map((item) => item.id)),
    client.from('event_organizers').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id).in('id', organizers.map((item) => item.id)),
  ])
  if (venueCheck.error || organizerCheck.error || venueCheck.count !== venues.length || organizerCheck.count !== organizers.length) throw new Error('Verifikasi seed tidak lengkap.')
  console.log(`${venueCheck.count} venue dan ${organizerCheck.count} EO tersimpan dan terverifikasi.`)
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
