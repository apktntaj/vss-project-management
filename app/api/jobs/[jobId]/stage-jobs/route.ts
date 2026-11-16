import { NextRequest, NextResponse } from 'next/server'

import { requireCurrentUser } from '@/features/auth'
import { createStageJob } from '@/features/jobs'
import { jobStageCreateSchema } from '@/domain/job/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

/** Buat job turunan (BC 2.5 / BC 3.0) dari job masuk — override manual operator. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const input = jobStageCreateSchema.parse(await request.json())
    const job = await createStageJob(currentUser, params.jobId, input.stage)
    return NextResponse.json(job, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
