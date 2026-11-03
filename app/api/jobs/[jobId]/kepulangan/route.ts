import { NextRequest, NextResponse } from 'next/server'

import { requireCurrentUser } from '@/features/auth'
import { saveJobKepulangan } from '@/features/jobs'
import { jobKepulanganPutSchema } from '@/domain/job/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

/** Ganti fase kepulangan job; `kepulangan: null` mengosongkannya. */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const { version, kepulangan } = jobKepulanganPutSchema.parse(await request.json())
    const job = await saveJobKepulangan(currentUser, params.jobId, version, kepulangan)
    return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
