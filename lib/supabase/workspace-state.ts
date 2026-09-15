import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type WorkspaceStateRow = { id: string; state: Record<string, unknown>; revision: number }

/** Server-only optimistic-concurrency store for the runtime aggregate. */
export async function getWorkspaceState(workspaceSlug = 'default'): Promise<WorkspaceStateRow> {
  const { data, error } = await getSupabaseAdmin()
    .from('workspaces')
    .select('id, state, revision')
    .eq('slug', workspaceSlug)
    .single<WorkspaceStateRow>()
  if (error) throw new Error(`Workspace tidak dapat dimuat: ${error.message}`)
  return data
}

export async function saveWorkspaceState(workspaceId: string, expectedRevision: number, state: Record<string, unknown>) {
  const { data, error } = await getSupabaseAdmin().rpc('save_workspace_state', {
    target_workspace_id: workspaceId,
    expected_revision: expectedRevision,
    next_state: state,
  })
  if (error) throw new Error(`Workspace tidak dapat disimpan: ${error.message}`)
  if (typeof data !== 'number') throw new Error('Respons revision workspace tidak valid.')
  return data
}
