import { NextRequest, NextResponse } from 'next/server'

// Terapkan hasil ekstraksi dokumen (invoice / B/L / AWB) ke operational job — dari upload dokumen
// maupun koreksi manual di dialog editor dokumen. Penggabungannya terjadi di server.

import { requireCurrentUser } from '@/features/auth'
import { applyJobExtraction } from '@/features/jobs'
import { jobExtractionSchema } from '@/domain/job/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const input = jobExtractionSchema.parse(await request.json())
    const job = await applyJobExtraction(currentUser, params.jobId, input)
    return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
