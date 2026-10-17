import { NextRequest, NextResponse } from 'next/server'

// Mengapa: route handler TIPIS untuk master data venue (create-inline + select existing, Req 12).
// Tanggung jawab handler hanya: autentikasi (`requireCurrentUser` → 401), parse input Zod di batas,
// delegasi ke use-case (AuthZ `reference:create`/`event:read` hidup DI SANA), map hasil/err. Tidak
// ada SQL/aturan bisnis di route (Req 7.7, 8.1). Mengikuti pola `app/api/events/route.ts`.

import { requireCurrentUser } from '@/features/auth'
import { createVenue, listVenueReferences } from '@/features/events'
import { referenceVenueInputSchema } from '@/domain/event/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Daftar venue dalam workspace untuk memilih yang sudah ada (Req 12.1). */
export async function GET() {
  try {
    const currentUser = await requireCurrentUser()
    const venues = await listVenueReferences(currentUser)
    return NextResponse.json(venues, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * Buat venue (create-inline). Parse `referenceVenueInputSchema` (nama kosong/spasi → 400,
 * Req 12.4), delegasi ke use-case `createVenue` (otorisasi `reference:create`), kembalikan record
 * tersimpan dengan status 201 — id-nya dipakai event sebagai FK (Req 12.2/12.3).
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser()
    const input = referenceVenueInputSchema.parse(await request.json())
    const venue = await createVenue(currentUser, input)
    return NextResponse.json(venue, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
