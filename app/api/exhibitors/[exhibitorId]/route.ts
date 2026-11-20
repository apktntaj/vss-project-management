import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireCurrentUser } from '@/features/auth'
import { updateExhibitor } from '@/features/exhibitors'
import { exhibitorUpdateSchema } from '@/domain/exhibitor/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const viaJobIdSchema = z.string().uuid().optional()

type RouteContext = { params: { exhibitorId: string } }

/**
 * Ubah data exhibitor (nama, jenis, NPWP, kontak, hall, booth). Query `viaJobId`: job milik
 * pengguna sebagai jalur otorisasi bagi non-PIC.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const viaJobId = viaJobIdSchema.parse(
      request.nextUrl.searchParams.get('viaJobId') ?? undefined,
    )
    const patch = exhibitorUpdateSchema.parse(await request.json())
    const exhibitor = await updateExhibitor(currentUser, params.exhibitorId, patch, viaJobId ?? null)
    return NextResponse.json(exhibitor, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
