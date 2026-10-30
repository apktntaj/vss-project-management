import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  deriveMandatoryDocuments,
  type LinkedDocument,
  type MandatoryDocumentView,
} from '@/domain/exhibition/mandatory-documents'
import type { CiplVersion, Shipment } from '@/domain/exhibition/types'

export type ShipmentDocumentView = {
  id: string
  ownerType: string
  ownerId: string
  kind: string | null
  fileName: string
  mimeType: string
  fileSize: number
  createdAt: string
}

export async function loadShipmentDocuments(
  client: SupabaseClient,
  workspaceId: string,
  shipment: Shipment,
): Promise<{ documents: ShipmentDocumentView[]; completeness: MandatoryDocumentView }> {
  const { data: rows, error } = await client
    .from('attachments')
    .select('id, owner_type, owner_id, kind, file_name, mime_type, file_size, created_at')
    .eq('workspace_id', workspaceId)
    .eq('owner_type', 'SHIPMENT')
    .eq('owner_id', shipment.id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Dokumen shipment tidak dapat dimuat: ${error.message}`)

  const documents: ShipmentDocumentView[] = (rows ?? []).map((row) => ({
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    kind: row.kind,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }))

  const linked: LinkedDocument[] = []
  for (const document of documents) {
    if (document.kind === 'TRANSPORT') {
      linked.push({ id: document.id, kind: shipment.documentType === 'BL' ? 'BILL_OF_LADING' : 'AIR_WAYBILL' })
    } else if (document.kind === 'CIPL') {
      linked.push({ id: document.id, kind: 'CIPL' })
    }
  }

  if (!linked.some((document) => document.kind === 'CIPL') && shipment.sourceCiplVersionId) {
    const { data: versionRow, error: versionError } = await client
      .from('cipl_versions')
      .select('payload')
      .eq('workspace_id', workspaceId)
      .eq('id', shipment.sourceCiplVersionId)
      .maybeSingle<{ payload: CiplVersion }>()
    if (versionError) throw new Error(`Versi CIPL tidak dapat dimuat: ${versionError.message}`)
    if (versionRow?.payload?.sourceDocument) {
      linked.push({ id: shipment.sourceCiplVersionId, kind: 'CIPL' })
    }
  }

  return { documents, completeness: deriveMandatoryDocuments(linked) }
}
