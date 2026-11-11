import { NextRequest, NextResponse } from 'next/server'

// Surat permohonan fasilitas pabean ke Kanwil DJBC untuk satu job International, dalam PDF.
// Nomor/tanggal/salam datang dari dialog; sisanya dari server (job, event, venue/pengusaha TPPB).

import { requireCurrentUser } from '@/features/auth'
import { loadKanwilDocumentContext } from '@/features/jobs'
import { jobFileName } from '@/domain/job/numbering'
import { buildKanwilLetter, kanwilLetterInputSchema, missingKanwilLetterFields } from '@/lib/kanwil-letter'
import { ApiError, toErrorResponse } from '@/lib/server/errors'
import { renderKanwilLetterPdf } from '@/lib/server/kanwil-letter-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const input = kanwilLetterInputSchema.parse(await request.json())
    const { job, event, venue } = await loadKanwilDocumentContext(currentUser, params.jobId)
    const missing = missingKanwilLetterFields(event, venue)
    if (missing.length > 0) {
      throw new ApiError(400, `Lengkapi data berikut sebelum membuat surat: ${missing.join(', ')}.`)
    }
    const file = await renderKanwilLetterPdf(buildKanwilLetter(event, venue, input))
    const filename = jobFileName(job, 'SURAT-KANWIL', 'pdf')
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
