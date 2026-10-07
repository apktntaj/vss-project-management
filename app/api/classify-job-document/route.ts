import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { DocumentExtractionError, extractDocument } from '@/lib/server/document-extraction'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File harus berupa PDF atau Excel.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await extractDocument(file))
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Dokumen tidak dapat diklasifikasikan.' }, { status: 502 })
  }
}
