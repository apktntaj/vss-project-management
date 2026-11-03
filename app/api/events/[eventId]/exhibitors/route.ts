import { NextRequest, NextResponse } from 'next/server'

// Exhibitor per event: daftar dan pendaftaran (bisa batch, mis. dari scan CIPL). Route tipis:
// sesi (401) → Zod → use-case → `toErrorResponse`.

import { requireCurrentUser } from '@/features/auth'
import { createExhibitors, listEventExhibitors } from '@/features/exhibitors'
import { exhibitorCreateBatchSchema } from '@/domain/exhibitor/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const exhibitors = await listEventExhibitors(currentUser, params.eventId)
    return NextResponse.json(exhibitors, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/** Body: array exhibitor baru; respons berurutan sama dengan masukan. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const inputs = exhibitorCreateBatchSchema.parse(await request.json())
    const exhibitors = await createExhibitors(currentUser, params.eventId, inputs)
    return NextResponse.json(exhibitors, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
