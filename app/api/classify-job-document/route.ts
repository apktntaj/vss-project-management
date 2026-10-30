import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { DocumentExtractionError } from '@/lib/server/extraction/errors'
import { classifyJobDocument, toLegacyDocumentKind } from '@/lib/server/extraction/job-classify'

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
    const result = await classifyJobDocument(file)
    return NextResponse.json({
      // classification memakai 5 jenis legacy agar konsumen lama tetap jalan.
      classification: {
        ...result.classification,
        documentType: toLegacyDocumentKind(result.classification.documentType),
      },
      invoice: result.invoice,
      transport: result.transport,
      detail: {
        method: result.method,
        documentType: result.classification.documentType,
        confidence: result.classification.confidence,
        needsUserConfirmation: result.classification.needsUserConfirmation,
        rationale: result.classification.rationale,
        fieldConfidence: result.fieldConfidence,
        aggregateConfidence: result.aggregateConfidence,
        band: result.band,
      },
    })
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Dokumen tidak dapat diklasifikasikan.' }, { status: 502 })
  }
}
