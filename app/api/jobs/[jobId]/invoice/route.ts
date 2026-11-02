import { NextRequest, NextResponse } from 'next/server'

import { requireCurrentUser } from '@/features/auth'
import { saveJobInvoice } from '@/features/jobs'
import { jobInvoicePutSchema } from '@/domain/job/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

/** Ganti tagihan job ke pihaknya (satu job = satu tagihan). */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const { version, invoice } = jobInvoicePutSchema.parse(await request.json())
    const job = await saveJobInvoice(currentUser, params.jobId, version, invoice)
    return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
