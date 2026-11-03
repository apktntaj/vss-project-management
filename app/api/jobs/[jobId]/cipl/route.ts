import { NextRequest, NextResponse } from 'next/server'

import { requireCurrentUser } from '@/features/auth'
import { saveJobCipl } from '@/features/jobs'
import { jobCiplPutSchema } from '@/domain/job/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

/** Ganti CIPL job: dokumen mentah + seluruh baris CIPL per exhibitor, dalam satu transaksi. */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const input = jobCiplPutSchema.parse(await request.json())
    const job = await saveJobCipl(currentUser, params.jobId, input)
    return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
