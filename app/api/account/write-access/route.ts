import { NextResponse } from 'next/server'

import { requireCurrentUser } from '@/features/auth'
import { getMyWriteAccess } from '@/features/events'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Akses tulis milik sesi: event yang dipegang/diberi akses + jenis job yang dipegang. */
export async function GET() {
  try {
    const currentUser = await requireCurrentUser()
    const access = await getMyWriteAccess(currentUser)
    return NextResponse.json(access, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
