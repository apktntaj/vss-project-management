import { NextRequest, NextResponse } from 'next/server'

import { requireCurrentUser } from '@/features/auth'
import { suggestManifestSeq } from '@/features/jobs'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

/** Saran urutan No Job berikutnya (awalan job ini, di event-nya). Operator yang menetapkan. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const suggestion = await suggestManifestSeq(currentUser, params.jobId)
    return NextResponse.json(suggestion, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
