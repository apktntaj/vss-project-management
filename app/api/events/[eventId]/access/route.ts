import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Mengapa: route TIPIS kelola hak akses event (co-PIC). Otorisasi (PIC/admin saja) ditegakkan di
// use-case `manage-event-access`; route hanya autentikasi → parse → delegasi.

import { requireCurrentUser } from '@/features/auth'
import { grantEventAccess, listEventAccess, revokeEventAccess } from '@/features/events'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

const accessBodySchema = z.object({ userId: z.string().uuid() }).strict()

/** Penerima akses saat ini + calon penerima (`{ grantees, candidates }`). */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    return NextResponse.json(await listEventAccess(currentUser, params.eventId))
  } catch (error) {
    return toErrorResponse(error)
  }
}

/** Beri akses kelola event ke `userId`. Sukses → 201 tanpa body. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const { userId } = accessBodySchema.parse(await request.json())
    await grantEventAccess(currentUser, params.eventId, userId)
    return new NextResponse(null, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/** Cabut akses kelola event dari `userId`. Sukses → 204 tanpa body. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const { userId } = accessBodySchema.parse(await request.json())
    await revokeEventAccess(currentUser, params.eventId, userId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
