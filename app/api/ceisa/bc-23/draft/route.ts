import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createBc23Draft } from '@/lib/ceisa/bc23-draft'
import { DocumentExtractionError, extractDocument } from '@/lib/server/document-extraction'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  }

  const formData = await request.formData()
  const invoiceFile = formData.get('invoice')
  const transportFile = formData.get('transport')
  if (!(invoiceFile instanceof File) || !(transportFile instanceof File)) {
    return NextResponse.json({ error: 'Commercial Invoice dan B/L atau AWB wajib diunggah.' }, { status: 400 })
  }

  try {
    const [invoiceDocument, transportDocument] = await Promise.all([
      extractDocument(invoiceFile),
      extractDocument(transportFile),
    ])
    if (!invoiceDocument.invoice || invoiceDocument.classification.documentType !== 'COMMERCIAL_INVOICE') {
      return NextResponse.json({ error: 'File invoice tidak teridentifikasi sebagai Commercial Invoice.' }, { status: 400 })
    }
    if (!transportDocument.transport || !['BILL_OF_LADING', 'AIR_WAYBILL'].includes(transportDocument.classification.documentType)) {
      return NextResponse.json({ error: 'File transport tidak teridentifikasi sebagai B/L atau AWB.' }, { status: 400 })
    }

    return NextResponse.json(createBc23Draft({
      invoice: invoiceDocument.invoice,
      transport: transportDocument.transport,
      generatedAt: new Date().toISOString(),
    }))
  } catch (error) {
    const correlationId = crypto.randomUUID()
    const status = error instanceof DocumentExtractionError ? error.status : 502
    console.error('BC 2.3 draft extraction failed', { correlationId, status })
    return NextResponse.json({
      error: error instanceof DocumentExtractionError ? error.message : 'Draft BC 2.3 tidak dapat dibuat.',
    }, { status })
  }
}
