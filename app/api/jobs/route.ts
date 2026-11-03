import { NextRequest, NextResponse } from 'next/server'

// Route TIPIS untuk koleksi job: sesi (401) → parse Zod → use-case → `toErrorResponse`.
// Penyaringan terjadi di SQL; tidak ada lagi pemuatan seluruh tabel untuk disaring di browser.

import { requireCurrentUser } from '@/features/auth'
import { createJob, listJobsForUser } from '@/features/jobs'
import { jobCreateSchema, jobListQuerySchema } from '@/domain/job/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** `GET /api/jobs?eventId=&status=&search=&view=full|summary` */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser()
    const params = request.nextUrl.searchParams
    const query = jobListQuerySchema.parse({
      eventId: params.get('eventId') || undefined,
      status: params.get('status') || undefined,
      search: params.get('search') || undefined,
      view: params.get('view') || undefined,
    })
    const jobs = await listJobsForUser(currentUser, query)
    return NextResponse.json(jobs, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser()
    const input = jobCreateSchema.parse(await request.json())
    const job = await createJob(currentUser, input)
    return NextResponse.json(job, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
