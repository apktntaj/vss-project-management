import { NextResponse } from 'next/server'

import { ciplVersionFromExtractionSchema, validateCiplVersionReady } from '@/domain/exhibition/validation'
import type { Cipl, CiplItem, CiplVersion } from '@/domain/exhibition/types'
import type { JobInvoiceExtraction } from '@/domain/exhibition/source-documents'
import { getEventApiContext } from '@/lib/supabase/event-api'
import { downloadAttachment } from '@/lib/supabase/attachments'
import { listRecords, saveRecord } from '@/lib/supabase/operational-records'
import { DocumentExtractionError } from '@/lib/server/extraction/errors'
import { mergePackingListAndInvoice } from '@/lib/server/extraction/cipl-merge'
import { extractFields } from '@/lib/server/extraction/deterministic/field-extractor'
import { parsePdfTextLayer } from '@/lib/server/extraction/deterministic/pdf-text-parser'
import { parseSpreadsheet } from '@/lib/server/extraction/deterministic/xlsx-parser'
import { isSpreadsheet } from '@/lib/server/extraction/file-guard'
import { extractionRouteFailure } from '@/lib/server/extraction/route-failure'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMPTY_INVOICE: JobInvoiceExtraction = {
  invoiceNumber: null, invoiceDate: null, seller: null, buyer: null, currency: null,
  incoterm: null, incotermLocation: null, totalAmount: null, freightAmount: null, insuranceAmount: null,
  totalGrossWeightKg: null, totalNetWeightKg: null, totalPackageCount: null, packageType: null, items: [],
}

export async function POST(request: Request) {
  try {
    const { client, workspaceId, userId } = await getEventApiContext()
    const body = await request.json().catch(() => null)
    const input = ciplVersionFromExtractionSchema.parse(body)

    const { data: ciplRow, error: ciplError } = await client
      .from('cipls')
      .select('payload')
      .eq('workspace_id', workspaceId)
      .eq('id', input.ciplId)
      .maybeSingle<{ payload: Cipl }>()
    if (ciplError) throw new Error(`CIPL tidak dapat dimuat: ${ciplError.message}`)
    if (!ciplRow?.payload) {
      return NextResponse.json({ error: 'Pemilik dokumen tidak ditemukan.', code: 'OWNER_NOT_FOUND' }, { status: 400 })
    }
    const cipl = ciplRow.payload

    if (input.source.kind === 'SPLIT') {
      await assertMergeable(input.source.packingListAttachmentId, input.source.invoiceAttachmentId)
    }

    const versions = (await listRecords<CiplVersion>('cipl_versions')).filter((version) => version.ciplId === input.ciplId)
    const timestamp = new Date().toISOString()
    const items: CiplItem[] = input.items.map((item, index) => ({
      id: crypto.randomUUID(),
      lineNumber: index + 1,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitValue: item.unitValue,
      currency: item.currency,
      grossWeightKg: item.grossWeightKg,
      netWeightKg: item.netWeightKg,
      countryOfOrigin: item.countryOfOrigin,
      identifiers: [],
      intendedUse: null,
      intendedDisposal: null,
    }))
    const sourceDocument = await attachmentMetadata(client, workspaceId, input.source)
    const version: CiplVersion = {
      id: crypto.randomUUID(),
      ciplId: input.ciplId,
      versionNumber: Math.max(0, ...versions.map((version) => version.versionNumber)) + 1,
      receivedAt: timestamp,
      receivedBy: userId,
      sourceDocumentName: sourceDocument?.fileName ?? null,
      sourceDocument: sourceDocument,
      items,
      revisionNote: null,
      createdAt: timestamp,
    }

    const validation = validateCiplVersionReady(version)
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.issues.map((issue) => issue.message).join(' '), code: 'ALLOCATION_INVARIANT_VIOLATED' },
        { status: 400 },
      )
    }

    await saveRecord('cipl_versions', version)
    await saveRecord('cipls', {
      ...cipl,
      activeVersionId: version.id,
      status: 'UNDER_REVIEW',
      sourceDocumentUnavailable: false,
      updatedAt: timestamp,
    })
    return NextResponse.json({ version }, { status: 201 })
  } catch (error) {
    return extractionRouteFailure(error)
  }
}

type SourceInput = { kind: 'COMBINED'; documentType: 'CIPL_COMBINED'; attachmentId: string } | { kind: 'SPLIT'; packingListAttachmentId: string; invoiceAttachmentId: string }

/**
 * Invariant alokasi (R5.6/R5.7): versi baru belum memiliki shipment, jadi validateShipmentAllocation
 * berjalan pada kandidat kosong (trivially valid); yang aktif divalidasi adalah validateCiplVersionReady.
 */
async function attachmentMetadata(client: Awaited<ReturnType<typeof getEventApiContext>>['client'], workspaceId: string, source: SourceInput) {
  const primaryId = source.kind === 'COMBINED' ? source.attachmentId : source.packingListAttachmentId
  const { data, error } = await client
    .from('attachments')
    .select('id, file_name, mime_type, file_size, created_at')
    .eq('workspace_id', workspaceId)
    .eq('id', primaryId)
    .maybeSingle<{ id: string; file_name: string; mime_type: string; file_size: number; created_at: string }>()
  if (error) throw new Error(`Lampiran tidak dapat dimuat: ${error.message}`)
  if (!data) throw new DocumentExtractionError('Pemilik dokumen tidak ditemukan.', 400, 'OWNER_NOT_FOUND')
  return { id: data.id, fileName: data.file_name, mimeType: data.mime_type, fileSize: data.file_size, createdAt: data.created_at }
}

async function assertMergeable(packingListAttachmentId: string, invoiceAttachmentId: string) {
  const [packingList, invoice] = await Promise.all([
    invoiceFromAttachment(packingListAttachmentId),
    invoiceFromAttachment(invoiceAttachmentId),
  ])
  if (!packingList.items.length || !invoice.items.length) return
  const merge = mergePackingListAndInvoice({ packingList, invoice })
  if (merge.ok) return
  const detail = merge.unmatched
    .map((row) => `"${row.description}" (${row.source === 'PACKING_LIST' ? 'Packing List' : 'Commercial Invoice'})`)
    .join('; ')
  throw new DocumentExtractionError(`Baris barang tidak dapat dipadankan: ${detail}.`, 400, 'CIPL_MERGE_UNMATCHED')
}

async function invoiceFromAttachment(attachmentId: string): Promise<JobInvoiceExtraction> {
  const downloaded = await downloadAttachment(attachmentId)
  if (!downloaded) throw new DocumentExtractionError('Pemilik dokumen tidak ditemukan.', 400, 'OWNER_NOT_FOUND')
  const file = new File([downloaded.file], downloaded.fileName, { type: downloaded.mimeType })
  const parsed = isSpreadsheet(file) ? await parseSpreadsheet(file) : await parsePdfTextLayer(file)
  return (extractFields(parsed).invoice as JobInvoiceExtraction | null) ?? EMPTY_INVOICE
}
