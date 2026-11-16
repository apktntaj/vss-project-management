import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const attachmentOwners = ['JOB', 'EVENT'] as const
export type AttachmentOwner = (typeof attachmentOwners)[number]

type AttachmentRow = {
  id: string
  owner_type: AttachmentOwner
  owner_id: string
  kind: string | null
  file_name: string
  mime_type: string
  file_size: number
  storage_path: string
  created_at: string
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

export async function uploadAttachment(input: {
  id: string
  ownerType: AttachmentOwner
  ownerId: string
  kind?: string | null
  file: File
}) {
  const workspace_id = await workspaceId()
  const storagePath = `${workspace_id}/${input.ownerType}/${input.ownerId}/${input.id}`
  const admin = getSupabaseAdmin()
  const { error: uploadError } = await admin.storage.from('attachments').upload(storagePath, input.file, {
    contentType: input.file.type || 'application/octet-stream',
    upsert: false,
  })
  if (uploadError) throw new Error(`Lampiran tidak dapat diunggah: ${uploadError.message}`)
  const { error: recordError } = await admin.from('attachments').insert({
    workspace_id,
    id: input.id,
    owner_type: input.ownerType,
    owner_id: input.ownerId,
    kind: input.kind ?? null,
    file_name: input.file.name,
    mime_type: input.file.type || 'application/octet-stream',
    file_size: input.file.size,
    storage_path: storagePath,
  })
  if (recordError) {
    await admin.storage.from('attachments').remove([storagePath])
    throw new Error(`Metadata lampiran tidak dapat disimpan: ${recordError.message}`)
  }
  return { id: input.id, fileName: input.file.name, mimeType: input.file.type || 'application/octet-stream', fileSize: input.file.size, createdAt: new Date().toISOString() }
}
export type AttachmentMeta = {
  id: string
  kind: string | null
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
}

/** Metadata lampiran milik satu pemilik (terbaru dulu); isi file lewat `downloadAttachment`. */
export async function listAttachmentsByOwner(
  ownerType: AttachmentOwner,
  ownerId: string,
): Promise<AttachmentMeta[]> {
  const workspace_id = await workspaceId()
  const { data, error } = await getSupabaseAdmin()
    .from('attachments')
    .select('id, kind, file_name, mime_type, file_size, created_at')
    .eq('workspace_id', workspace_id)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .returns<
      Array<Pick<AttachmentRow, 'id' | 'kind' | 'file_name' | 'mime_type' | 'file_size' | 'created_at'>>
    >()
  if (error) throw new Error(`Lampiran tidak dapat dimuat: ${error.message}`)
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }))
}

/** Metadata lampiran ber-`kind` tertentu untuk banyak pemilik sekaligus (satu query), terbaru dulu. */
export async function listAttachmentsForOwners(
  ownerType: AttachmentOwner,
  ownerIds: ReadonlyArray<string>,
  kind: string,
): Promise<Array<AttachmentMeta & { ownerId: string }>> {
  if (!ownerIds.length) return []
  const workspace_id = await workspaceId()
  const { data, error } = await getSupabaseAdmin()
    .from('attachments')
    .select('id, owner_id, kind, file_name, mime_type, file_size, created_at')
    .eq('workspace_id', workspace_id)
    .eq('owner_type', ownerType)
    .eq('kind', kind)
    .in('owner_id', [...ownerIds])
    .order('created_at', { ascending: false })
    .returns<
      Array<Pick<AttachmentRow, 'id' | 'owner_id' | 'kind' | 'file_name' | 'mime_type' | 'file_size' | 'created_at'>>
    >()
  if (error) throw new Error(`Lampiran tidak dapat dimuat: ${error.message}`)
  return (data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    kind: row.kind,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }))
}

/** Hapus lampiran (objek bucket lalu baris metadata). Id yang tidak ada diabaikan. */
export async function deleteAttachments(ids: ReadonlyArray<string>): Promise<void> {
  if (!ids.length) return
  const workspace_id = await workspaceId()
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('attachments')
    .select('storage_path')
    .eq('workspace_id', workspace_id)
    .in('id', [...ids])
    .returns<Array<Pick<AttachmentRow, 'storage_path'>>>()
  if (error) throw new Error(`Lampiran tidak dapat dimuat: ${error.message}`)
  const paths = (data ?? []).map((row) => row.storage_path)
  if (paths.length) {
    const { error: removeError } = await admin.storage.from('attachments').remove(paths)
    if (removeError) throw new Error(`Lampiran tidak dapat dihapus: ${removeError.message}`)
  }
  const { error: deleteError } = await admin
    .from('attachments')
    .delete()
    .eq('workspace_id', workspace_id)
    .in('id', [...ids])
  if (deleteError) throw new Error(`Metadata lampiran tidak dapat dihapus: ${deleteError.message}`)
}

export async function downloadAttachment(id: string) {
  const workspace_id = await workspaceId()
  const { data, error } = await getSupabaseAdmin()
    .from('attachments')
    .select('storage_path, mime_type, file_name')
    .eq('workspace_id', workspace_id)
    .eq('id', id)
    .maybeSingle<Pick<AttachmentRow, 'storage_path' | 'mime_type' | 'file_name'>>()
  if (error) throw new Error(`Lampiran tidak dapat dimuat: ${error.message}`)
  if (!data) return null
  const { data: file, error: downloadError } = await getSupabaseAdmin().storage.from('attachments').download(data.storage_path)
  if (downloadError) throw new Error(`Lampiran tidak dapat diunduh: ${downloadError.message}`)
  return { file, mimeType: data.mime_type, fileName: data.file_name }
}
