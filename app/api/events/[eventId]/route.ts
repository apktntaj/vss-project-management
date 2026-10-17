import { NextRequest, NextResponse } from 'next/server'

// Mengapa: route handler TIPIS untuk satu event (clean cutover DD-A4 — mengganti handler lama yang
// memegang SQL penghapusan berantai + guard PIC inline). Handler hanya: `requireCurrentUser` (401),
// parse Zod di batas, delegasi ke use-case (AuthZ per-objek + invariant data-turunan hidup DI SANA),
// map hasil/err via `toErrorResponse`. Tidak ada SQL/aturan bisnis di route (Req 2.3/2.5/7.7/8.1).

import { requireCurrentUser } from '@/features/auth'
import { deleteEvent, updateEvent } from '@/features/events'
import { eventInputSchema } from '@/domain/event/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { eventId: string } }

/**
 * Perbarui event. Parse `eventInputSchema` (format + invariant tanggal), delegasi ke use-case
 * `updateEvent` (otorisasi + 404 + invariant referensi), kembalikan event terbaru dengan status 200.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    const input = eventInputSchema.parse(await request.json())
    const event = await updateEvent(currentUser, params.eventId, input)
    return NextResponse.json(event, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * Hapus event. Delegasi ke use-case `deleteEvent` (otorisasi per-objek PIC/SUPERVISOR + 404 +
 * 409 bila ada data turunan). Pada sukses kembalikan 204 tanpa body (Req 14.2).
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser()
    await deleteEvent(currentUser, params.eventId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return toErrorResponse(error)
  }
}
