import { NextRequest, NextResponse } from 'next/server'

// Mengapa: route TIPIS khusus pengarsipan event — alternatif non-destruktif dari DELETE, dipisah
// agar handler tunggal-tujuan. Tidak ada body yang perlu di-parse (arsip hanya transisi lifecycle);
// delegasi ke use-case `archiveEvent` (otorisasi `event:update` + 404 + set ARCHIVED, pertahankan
// data turunan). Tidak ada SQL/aturan bisnis di route (Req 14.4/14.5, 8.1).

import { requireCurrentUser } from '@/features/auth'
import { archiveEvent } from '@/features/events'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

/** Arsipkan event. Sukses → 200 dengan event terbaru. */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const event = await archiveEvent(currentUser, params.eventId)
    return NextResponse.json(event, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}
