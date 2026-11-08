import { NextRequest, NextResponse } from 'next/server'

import { requireCurrentUser } from '@/features/auth'
import { cancelJob } from '@/features/jobs'
import { jobCancelSchema } from '@/domain/job/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

/** Batalkan job dengan alasan wajib. Job tidak pernah dihapus; setelah batal tak dapat diubah lagi. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const input = jobCancelSchema.parse(await request.json())
    const job = await cancelJob(currentUser, params.jobId, input)
    return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
