import 'server-only'

// Mengapa: pemilik query tabel `event_access` — hak kelola event per-pengguna (co-PIC) yang
// diberikan PIC/admin. Murni I/O; keputusan siapa boleh memberi/mencabut milik use-case
// `manage-event-access`. Setiap query disaring `workspace_id` dari `withWorkspace()`.

import { withWorkspace } from '@/lib/server/db'
import { firstRelation } from './shared'

export type EventGrantee = { userId: string; fullName: string; grantedAt: string }

/** Apakah `userId` penerima akses eksplisit pada event ini? */
export async function hasEventAccess(eventId: string, userId: string): Promise<boolean> {
  const { client, workspaceId } = await withWorkspace()

  const { count, error } = await client
    .from('event_access')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('event_id', eventId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Gagal memeriksa akses event: ${error.message}`)
  }
  return (count ?? 0) > 0
}

type GranteeRow = {
  user_id: string
  granted_at: string
  // `event_access` punya dua FK ke app_users (user_id, granted_by_id) — embed harus eksplisit.
  user: { full_name: string } | { full_name: string }[] | null
}

/** Daftar penerima akses event (nama dari `app_users`), terurut waktu pemberian. */
export async function listEventGrantees(eventId: string): Promise<EventGrantee[]> {
  const { client, workspaceId } = await withWorkspace()

  const { data, error } = await client
    .from('event_access')
    .select('user_id, granted_at, user:app_users!event_access_user_id_fkey(full_name)')
    .eq('workspace_id', workspaceId)
    .eq('event_id', eventId)
    .order('granted_at')
    .returns<GranteeRow[]>()

  if (error) {
    throw new Error(`Gagal memuat akses event: ${error.message}`)
  }
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    fullName: firstRelation(row.user)?.full_name ?? '',
    grantedAt: row.granted_at,
  }))
}

/** Beri akses (idempoten: pemberian ulang tidak mengubah baris yang ada). */
export async function insertEventAccess(
  eventId: string,
  userId: string,
  grantedById: string,
): Promise<void> {
  const { client, workspaceId } = await withWorkspace()

  const { error } = await client.from('event_access').upsert(
    {
      workspace_id: workspaceId,
      event_id: eventId,
      user_id: userId,
      granted_by_id: grantedById,
    },
    { onConflict: 'workspace_id,event_id,user_id', ignoreDuplicates: true },
  )

  if (error) {
    throw new Error(`Gagal memberi akses event: ${error.message}`)
  }
}

/** Cabut akses (idempoten: tidak ada baris = no-op). */
export async function deleteEventAccess(eventId: string, userId: string): Promise<void> {
  const { client, workspaceId } = await withWorkspace()

  const { error } = await client
    .from('event_access')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('event_id', eventId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Gagal mencabut akses event: ${error.message}`)
  }
}

/** Apakah `userId` anggota workspace AKTIF? (target pemberian akses harus lolos ini.) */
export async function isActiveWorkspaceMember(userId: string): Promise<boolean> {
  const { client, workspaceId } = await withWorkspace()

  const { count, error } = await client
    .from('app_users')
    .select('id, workspace_members!inner(workspace_id)', { count: 'exact', head: true })
    .eq('id', userId)
    .eq('is_active', true)
    .eq('workspace_members.workspace_id', workspaceId)

  if (error) {
    throw new Error(`Gagal memeriksa anggota workspace: ${error.message}`)
  }
  return (count ?? 0) > 0
}
