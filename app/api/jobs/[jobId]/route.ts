import { NextRequest, NextResponse } from 'next/server'

// Route TIPIS untuk satu aggregate Job. Setiap tulis membawa `version` yang terakhir dibaca klien;
// use-case menolak dengan 409 bila job sudah diubah orang lain sejak itu.

import { requireCurrentUser } from '@/features/auth'
import { deleteJob, getJob, updateJobDetails } from '@/features/jobs'
import { jobDetailsPatchSchema } from '@/domain/job/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const job = await getJob(currentUser, params.jobId)
    return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const patch = jobDetailsPatchSchema.parse(await request.json())
    const job = await updateJobDetails(currentUser, params.jobId, patch)
    return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/** Hapus job beserta lampiran dan tiket berkonteks job ini. 204 tanpa body. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    await deleteJob(currentUser, params.jobId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
