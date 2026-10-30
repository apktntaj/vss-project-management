import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

import { DocumentExtractionError, assertSupportedDocumentFile } from '@/lib/server/document-extraction'
import { parseManifestFile } from '@/lib/server/manifest-extraction'

export const runtime = 'nodejs'

/** Autofill blok manifest job dari file inward manifest (PDF/Excel) via LLM terkonfigurasi. */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
    }

    const file = request.formData ? (await request.formData()).get('file') : null
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Lampirkan file manifest (PDF atau Excel).' }, { status: 400 })
    }
    try {
      assertSupportedDocumentFile(file)
    } catch (error) {
      const message = error instanceof DocumentExtractionError ? error.message : 'File harus berupa PDF atau Excel.'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const result = await parseManifestFile(file)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Manifest tidak dapat diproses.' }, { status: 500 })
  }
}
