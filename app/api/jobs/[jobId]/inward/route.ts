import { NextRequest, NextResponse } from 'next/server'

import { requireCurrentUser } from '@/features/auth'
import { saveJobInward } from '@/features/jobs'
import { jobInwardPutSchema } from '@/domain/job/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

/** Ganti blok inward manifest job (dokumen angkut, muatan, milestone, catatan). */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const { version, inward } = jobInwardPutSchema.parse(await request.json())
    const job = await saveJobInward(currentUser, params.jobId, version, inward)
    return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
