import { NextRequest, NextResponse } from 'next/server'

import { requireCurrentUser } from '@/features/auth'
import { bupDocumentSchema } from '@/domain/it-inventory/validation'
import { parseBupWorkbook } from '@/lib/server/it-inventory/bup-parser'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Parse satu file export BUP (BC 2.3 / BC 2.5 / BC 3.0) menjadi `BupDocument` untuk buku arus
 * barang. Demo tanpa penyimpanan: hasil hanya dikembalikan ke klien, tidak dipersisten.
 */
export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser()
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File BUP wajib disertakan.' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'File kosong dan tidak dapat dibaca.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10 MB.' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = parseBupWorkbook(file.name, buffer)
    // Stempel waktu posting (log aktivitas) — dijatuhkan di sini agar seragam jam server.
    const document = bupDocumentSchema.parse({ ...parsed, uploadedAt: new Date().toISOString() })
    return NextResponse.json(document, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
