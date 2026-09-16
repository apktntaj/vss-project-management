import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const operationalTables = [
  'operational_users', 'venues', 'event_organizers', 'events', 'exhibitors',
  'jobs', 'job_stages', 'job_documents', 'coordination_agents', 'cipls',
  'cipl_versions', 'shipments', 'customs_jobs', 'tickets', 'preferences',
  'migration_review_items',
] as const

export type OperationalTable = (typeof operationalTables)[number]

function assertTable(table: string): asserts table is OperationalTable {
  if (!(operationalTables as readonly string[]).includes(table)) throw new Error('Koleksi data tidak valid.')
}

async function workspaceId() {
  const { data, error } = await getSupabaseAdmin()
    .from('workspaces')
    .select('id')
    .eq('slug', 'default')
    .single<{ id: string }>()
  if (error || !data) throw new Error(`Workspace tidak dapat dimuat: ${error?.message ?? 'tidak ditemukan'}`)
  return data.id
}

export async function listRecords<T>(table: OperationalTable): Promise<T[]> {
  if (table === 'operational_users') {
    const { data, error } = await getSupabaseAdmin()
      .from('app_users')
      .select('id, full_name, email, role, is_active')
      .order('full_name')
    if (error) throw new Error(`Pengguna tidak dapat dimuat: ${error.message}`)
    return (data ?? []).map((user) => ({
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      isActive: user.is_active,
    }) as T)
  }
  const id = await workspaceId()
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .select('payload')
    .eq('workspace_id', id)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(`Data ${table} tidak dapat dimuat: ${error.message}`)
  return (data ?? []).map((row) => row.payload as T)
}

export async function getRecord<T>(table: OperationalTable, recordId: string): Promise<T | null> {
  if (table === 'operational_users') {
    const { data, error } = await getSupabaseAdmin()
      .from('app_users')
      .select('id, full_name, email, role, is_active')
      .eq('id', recordId)
      .maybeSingle()
    if (error) throw new Error(`Pengguna tidak dapat dimuat: ${error.message}`)
    return data ? {
      id: data.id,
      name: data.full_name,
      email: data.email,
      role: data.role,
      isActive: data.is_active,
    } as T : null
  }
  const id = await workspaceId()
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .select('payload')
    .eq('workspace_id', id)
    .eq('id', recordId)
    .maybeSingle<{ payload: T }>()
  if (error) throw new Error(`Data ${table} tidak dapat dimuat: ${error.message}`)
  return data?.payload ?? null
}

export async function saveRecord<T extends { id: string }>(table: OperationalTable, record: T): Promise<T> {
  if (table === 'operational_users') throw new Error('Pengguna dikelola melalui akun Supabase.')
  const id = await workspaceId()
  const { error } = await getSupabaseAdmin().from(table).upsert({
    workspace_id: id,
    id: record.id,
    payload: record,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,id' })
  if (error) throw new Error(`Data ${table} tidak dapat disimpan: ${error.message}`)
  return record
}

export async function removeRecord(table: OperationalTable, recordId: string) {
  const id = await workspaceId()
  const { error } = await getSupabaseAdmin()
    .from(table)
    .delete()
    .eq('workspace_id', id)
    .eq('id', recordId)
  if (error) throw new Error(`Data ${table} tidak dapat dihapus: ${error.message}`)
}
