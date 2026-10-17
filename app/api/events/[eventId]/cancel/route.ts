import { NextRequest, NextResponse } from 'next/server'

// Mengapa: route TIPIS khusus pembatalan event — dipisah dari PATCH edit agar setiap handler
// tunggal-tujuan (tanpa discriminator). Parse `cancelEventSchema` (alasan 1–1000, kosong/spasi →
// 400 di batas), delegasi ke use-case `cancelEvent` (otorisasi per-objek PIC/SUPERVISOR + transisi
// CANCELLED + catat cancellation). Tidak ada SQL/aturan bisnis di route (Req 13.x/15.x, 8.1).

import { requireCurrentUser } from '@/features/auth'
import { cancelEvent } from '@/features/events'
import { cancelEventSchema } from '@/domain/event/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

/** Batalkan event dengan alasan. Sukses → 200 tanpa body bermakna (aksi, bukan resource). */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const { reason } = cancelEventSchema.parse(await request.json())
    await cancelEvent(currentUser, params.eventId, reason)
    return new NextResponse(null, { status: 200 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
