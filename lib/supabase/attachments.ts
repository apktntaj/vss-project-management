import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const attachmentOwners = ['JOB'] as const
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

/** Hapus seluruh lampiran milik satu pemilik: objek di bucket lalu baris metadatanya. */
export async function removeAttachmentsOfOwner(ownerType: AttachmentOwner, ownerId: string) {
  const workspace_id = await workspaceId()
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('attachments')
    .select('id, storage_path')
    .eq('workspace_id', workspace_id)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .returns<Array<Pick<AttachmentRow, 'id' | 'storage_path'>>>()
  if (error) throw new Error(`Lampiran tidak dapat dimuat: ${error.message}`)
  if (!data?.length) return
  const { error: storageError } = await admin.storage
    .from('attachments')
    .remove(data.map((row) => row.storage_path))
  if (storageError) throw new Error(`Berkas lampiran tidak dapat dihapus: ${storageError.message}`)
  const { error: deleteError } = await admin
    .from('attachments')
    .delete()
    .eq('workspace_id', workspace_id)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
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
