import { NextResponse } from 'next/server'

import { extractDocumentSchema, supportingDocumentSchema } from '@/domain/exhibition/validation'
import { getEventApiContext } from '@/lib/supabase/event-api'
import { downloadAttachment, uploadAttachment } from '@/lib/supabase/attachments'
import { runDeterministicExtraction, runLlmExtraction } from '@/lib/server/extraction/extraction-service'
import { DocumentExtractionError, LLM_UNAVAILABLE_MESSAGE } from '@/lib/server/extraction/errors'
import { assertSupportedDocumentFile } from '@/lib/server/extraction/file-guard'
import { extractionRouteFailure } from '@/lib/server/extraction/route-failure'
import { resolveLlmProvider } from '@/lib/server/extraction/llm/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Visibilitas konfigurasi LLM untuk UI: tombol "Ekstrak ulang dengan LLM" (R3.4). */
export async function GET() {
  try {
    await getEventApiContext()
    return NextResponse.json({ llmAvailable: resolveLlmProvider() !== null })
  } catch (error) {
    return extractionRouteFailure(error)
  }
}

export async function POST(request: Request) {
  try {
    const { client, workspaceId } = await getEventApiContext()
    const form = await request.formData()
    const input = extractDocumentSchema.parse({
      ownerType: form.get('ownerType') ?? undefined,
      ownerId: form.get('ownerId') ?? undefined,
      intendedKind: form.get('intendedKind') ?? undefined,
      mode: form.get('mode') ?? undefined,
      attachmentId: form.get('attachmentId') ?? undefined,
    })

    if (input.mode === 'LLM') {
      if (!resolveLlmProvider()) {
        return NextResponse.json({ error: LLM_UNAVAILABLE_MESSAGE, code: 'LLM_NOT_CONFIGURED' }, { status: 503 })
      }
      const attachmentId = input.attachmentId as string
      await assertAttachmentOwned(client, workspaceId, input.ownerType, input.ownerId, attachmentId)
      const downloaded = await downloadAttachment(attachmentId)
      if (!downloaded) {
        return NextResponse.json({ error: 'Pemilik dokumen tidak ditemukan.', code: 'OWNER_NOT_FOUND' }, { status: 400 })
      }
      const file = new File([downloaded.file], downloaded.fileName, { type: downloaded.mimeType })
      try {
        const result = await runLlmExtraction(file)
        return NextResponse.json({ attachmentId, result })
      } catch (error) {
        throw withAttachmentId(error, attachmentId)
      }
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File dokumen wajib diunggah.', code: 'FILE_REQUIRED' }, { status: 400 })
    }
    assertSupportedDocumentFile(file)
    await assertOwnerExists(client, workspaceId, input.ownerType, input.ownerId)

    const attachmentId = crypto.randomUUID()
    const kind =
      input.intendedKind === 'SUPPORTING'
        ? parseSupportingLabel(form, input.ownerType, input.ownerId) ?? 'SUPPORTING_DOCUMENT'
        : input.intendedKind
    try {
      await uploadAttachment({ id: attachmentId, ownerType: input.ownerType, ownerId: input.ownerId, kind, file })
    } catch {
      throw new DocumentExtractionError('Gagal menyimpan dokumen. Silakan coba lagi.', 503, 'ATTACHMENT_STORE_UNAVAILABLE')
    }

    if (input.intendedKind === 'SUPPORTING') {
      return NextResponse.json({ attachmentId }, { status: 201 })
    }
    // Persist-first: file sudah tersimpan, jadi kegagalan ekstraksi apa pun tetap membawa attachmentId.
    try {
      const result = await runDeterministicExtraction(file, input.intendedKind)
      return NextResponse.json({ attachmentId, result })
    } catch (error) {
      throw withAttachmentId(error, attachmentId)
    }
  } catch (error) {
    return extractionRouteFailure(error)
  }
}

function withAttachmentId(error: unknown, attachmentId: string): DocumentExtractionError {
  if (error instanceof DocumentExtractionError) {
    return new DocumentExtractionError(error.message, error.status, error.code, { attachmentId })
  }
  return new DocumentExtractionError(
    error instanceof Error ? error.message : 'Dokumen tidak dapat diekstrak.',
    502,
    'EXTRACTION_SERVICE_UNAVAILABLE',
    { attachmentId },
  )
}

function parseSupportingLabel(form: FormData, ownerType: 'SHIPMENT' | 'CIPL_VERSION', ownerId: string): string | undefined {
  const raw = form.get('label')
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  return supportingDocumentSchema.parse({ ownerType, ownerId, label: raw.trim() }).label
}

async function assertOwnerExists(
  client: Awaited<ReturnType<typeof getEventApiContext>>['client'],
  workspaceId: string,
  ownerType: 'SHIPMENT' | 'CIPL_VERSION',
  ownerId: string,
) {
  // CIPL_VERSION merujuk CIPL induk: versi baru belum ada saat dokumen diunggah.
  const table = ownerType === 'SHIPMENT' ? 'shipments' : 'cipls'
  const { data, error } = await client
    .from(table)
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('id', ownerId)
    .maybeSingle<{ id: string }>()
  if (error) throw new Error(`Pemilik dokumen tidak dapat diperiksa: ${error.message}`)
  if (!data) throw new DocumentExtractionError('Pemilik dokumen tidak ditemukan.', 400, 'OWNER_NOT_FOUND')
}

async function assertAttachmentOwned(
  client: Awaited<ReturnType<typeof getEventApiContext>>['client'],
  workspaceId: string,
  ownerType: 'SHIPMENT' | 'CIPL_VERSION',
  ownerId: string,
  attachmentId: string,
) {
  const { data, error } = await client
    .from('attachments')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('id', attachmentId)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .maybeSingle<{ id: string }>()
  if (error) throw new Error(`Lampiran tidak dapat diperiksa: ${error.message}`)
  if (!data) throw new DocumentExtractionError('Pemilik dokumen tidak ditemukan.', 400, 'OWNER_NOT_FOUND')
}
