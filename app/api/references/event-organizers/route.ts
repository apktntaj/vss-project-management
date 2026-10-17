import { NextRequest, NextResponse } from 'next/server'

// Mengapa: route handler TIPIS untuk master data event organizer (create-inline + select existing,
// Req 12). Handler hanya: autentikasi → parse Zod → delegasi use-case → map hasil/err. Tidak ada
// SQL/aturan bisnis di route (Req 7.7, 8.1). Mengikuti pola `app/api/references/venues/route.ts`.

import { requireCurrentUser } from '@/features/auth'
import { createEventOrganizer, listEventOrganizerReferences } from '@/features/events'
import { referenceEventOrganizerInputSchema } from '@/domain/event/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Daftar event organizer dalam workspace untuk memilih yang sudah ada (Req 12.1). */
export async function GET() {
  try {
    const currentUser = await requireCurrentUser()
    const organizers = await listEventOrganizerReferences(currentUser)
    return NextResponse.json(organizers, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * Buat event organizer (create-inline). Parse `referenceEventOrganizerInputSchema` (nama kosong/
 * spasi → 400, Req 12.4), delegasi ke use-case `createEventOrganizer` (otorisasi
 * `reference:create`), kembalikan record tersimpan dengan status 201 — id-nya dipakai event sebagai
 * FK (Req 12.2/12.3).
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser()
    const input = referenceEventOrganizerInputSchema.parse(await request.json())
    const organizer = await createEventOrganizer(currentUser, input)
    return NextResponse.json(organizer, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
