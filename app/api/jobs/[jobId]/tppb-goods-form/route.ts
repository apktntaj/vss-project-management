import { NextRequest, NextResponse } from 'next/server'

// Form rincian barang pameran (lampiran surat Kanwil) untuk satu job International, dalam Excel.
// Satu baris per barang di semua baris CIPL job.

import { requireCurrentUser } from '@/features/auth'
import { loadKanwilDocumentContext } from '@/features/jobs'
import { jobFileName } from '@/domain/job/numbering'
import { ApiError, toErrorResponse } from '@/lib/server/errors'
import { renderTppbGoodsFormWorkbook } from '@/lib/server/tppb-goods-form-workbook'
import { buildTppbGoodsForm, missingTppbGoodsFormFields } from '@/lib/tppb-goods-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const { job, event, venue, exhibitors } = await loadKanwilDocumentContext(currentUser, params.jobId)
    const missing = missingTppbGoodsFormFields(event, venue)
    if (missing.length > 0) {
      throw new ApiError(400, `Lengkapi data berikut sebelum membuat form: ${missing.join(', ')}.`)
    }
    const model = buildTppbGoodsForm(event, venue, job, exhibitors)
    if (model.rows.length === 0) throw new ApiError(400, 'Job ini belum punya barang di CIPL.')
    const file = await renderTppbGoodsFormWorkbook(model)
    const filename = jobFileName(job, 'FORM-RINCIAN-BARANG', 'xlsx')
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
