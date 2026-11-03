import 'server-only'

// Satu-satunya pemilik query tabel `exhibitors`. Murni I/O; setiap query disaring `workspace_id`.

import { withWorkspace } from '@/lib/server/db'
import type { Exhibitor, ExhibitorContact } from '@/domain/exhibitor/types'
import type { ExhibitorCreateInput } from '@/domain/exhibitor/validation'

const EXHIBITOR_COLUMNS =
  'id, event_id, kind, name, npwp, contact, hall, booth, created_at, updated_at'

type ExhibitorRow = {
  id: string
  event_id: string
  kind: Exhibitor['kind']
  name: string
  npwp: string | null
  contact: Partial<ExhibitorContact> | null
  hall: string | null
  booth: string | null
  created_at: string
  updated_at: string
}

export type ExhibitorWritableColumns = Partial<{
  name: string
  kind: Exhibitor['kind']
  npwp: string | null
  contact: ExhibitorContact
  hall: string | null
  booth: string | null
}>

function toExhibitor(row: ExhibitorRow): Exhibitor {
  return {
    id: row.id,
    eventId: row.event_id,
    kind: row.kind,
    name: row.name,
    npwp: row.npwp,
    contact: {
      name: row.contact?.name ?? null,
      role: row.contact?.role ?? null,
      email: row.contact?.email ?? null,
      phone: row.contact?.phone ?? null,
    },
    hall: row.hall,
    booth: row.booth,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function listExhibitorsByEvent(eventId: string): Promise<Exhibitor[]> {
  if (!UUID.test(eventId)) return []
  const { client, workspaceId } = await withWorkspace()
  const { data, error } = await client
    .from('exhibitors')
    .select(EXHIBITOR_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('event_id', eventId)
    .order('name')
    .returns<ExhibitorRow[]>()
  if (error) throw new Error(`Gagal memuat exhibitor: ${error.message}`)
  return (data ?? []).map(toExhibitor)
}

export async function findExhibitorById(exhibitorId: string): Promise<Exhibitor | null> {
  if (!UUID.test(exhibitorId)) return null
  const { client, workspaceId } = await withWorkspace()
  const { data, error } = await client
    .from('exhibitors')
    .select(EXHIBITOR_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('id', exhibitorId)
    .maybeSingle<ExhibitorRow>()
  if (error) throw new Error(`Gagal memuat exhibitor: ${error.message}`)
  return data ? toExhibitor(data) : null
}

export async function insertExhibitors(
  eventId: string,
  inputs: ExhibitorCreateInput[],
  userId: string,
): Promise<Exhibitor[]> {
  const { client, workspaceId } = await withWorkspace()
  const { data, error } = await client
    .from('exhibitors')
    .insert(
      inputs.map((input) => ({
        workspace_id: workspaceId,
        event_id: eventId,
        kind: input.kind,
        name: input.name,
        npwp: input.kind === 'LOCAL' ? input.npwp : null,
        contact: input.contact,
        hall: input.hall,
        booth: input.booth,
        created_by_id: userId,
      })),
    )
    .select(EXHIBITOR_COLUMNS)
    .returns<ExhibitorRow[]>()
  if (error) throw new Error(`Gagal mendaftarkan exhibitor: ${error.message}`)
  // Insert batch mengembalikan baris sesuai urutan masukan.
  return (data ?? []).map(toExhibitor)
}

export async function updateExhibitorRow(
  exhibitorId: string,
  columns: ExhibitorWritableColumns,
): Promise<Exhibitor | null> {
  const { client, workspaceId } = await withWorkspace()
  const { data, error } = await client
    .from('exhibitors')
    .update({ ...columns, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('id', exhibitorId)
    .select(EXHIBITOR_COLUMNS)
    .maybeSingle<ExhibitorRow>()
  if (error) throw new Error(`Gagal menyimpan exhibitor: ${error.message}`)
  return data ? toExhibitor(data) : null
}
