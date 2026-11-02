import { NextRequest, NextResponse } from 'next/server'

import { requireCurrentUser } from '@/features/auth'
import { updateExhibitor } from '@/features/exhibitors'
import { exhibitorUpdateSchema } from '@/domain/exhibitor/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { exhibitorId: string } }

/** Ubah data exhibitor (nama, jenis, NPWP, kontak, hall, booth). */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const patch = exhibitorUpdateSchema.parse(await request.json())
    const exhibitor = await updateExhibitor(currentUser, params.exhibitorId, patch)
    return NextResponse.json(exhibitor, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
