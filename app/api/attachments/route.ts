import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/auth'
import {
  attachmentOwners,
  downloadAttachment,
  listAttachmentsByOwner,
  uploadAttachment,
  type AttachmentOwner,
} from '@/lib/supabase/attachments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const owners = new Set<string>(attachmentOwners)

export async function POST(request: NextRequest) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  try {
    const form = await request.formData()
    const id = form.get('id')
    const ownerType = form.get('ownerType')
    const ownerId = form.get('ownerId')
    const kind = form.get('kind')
    const file = form.get('file')
    if (typeof id !== 'string' || typeof ownerId !== 'string' || typeof ownerType !== 'string' || !owners.has(ownerType) || !(file instanceof File)) {
      return NextResponse.json({ error: 'Lampiran tidak valid.' }, { status: 400 })
    }
    return NextResponse.json(await uploadAttachment({ id, ownerId, ownerType: ownerType as AttachmentOwner, kind: typeof kind === 'string' ? kind : null, file }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lampiran tidak dapat diunggah.' }, { status: 503 })
  }
}

export async function GET(request: NextRequest) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  const id = request.nextUrl.searchParams.get('id')
  if (id) {
    try {
      const result = await downloadAttachment(id)
      if (!result) return new NextResponse(null, { status: 404 })
      return new NextResponse(result.file.stream(), { headers: { 'Content-Type': result.mimeType, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(result.fileName)}`, 'Cache-Control': 'private, no-store' } })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Lampiran tidak dapat dimuat.' }, { status: 503 })
    }
  }
  const ownerType = request.nextUrl.searchParams.get('ownerType')
  const ownerId = request.nextUrl.searchParams.get('ownerId')
  if (ownerType && ownerId) {
    if (!owners.has(ownerType))
      return NextResponse.json({ error: 'Owner lampiran tidak valid.' }, { status: 400 })
    try {
      return NextResponse.json(await listAttachmentsByOwner(ownerType as AttachmentOwner, ownerId), {
        headers: { 'Cache-Control': 'no-store' },
      })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Lampiran tidak dapat dimuat.' }, { status: 503 })
    }
  }
  return NextResponse.json({ error: 'ID lampiran atau owner wajib diisi.' }, { status: 400 })
}
