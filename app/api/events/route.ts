import { NextRequest, NextResponse } from 'next/server'

// Mengapa: route handler TIPIS untuk koleksi event (clean cutover DD-A4 — mengganti handler lama
// yang memegang SQL + aturan bisnis langsung). Tanggung jawab handler hanya: autentikasi
// (`requireCurrentUser` → 401), parse input dengan Zod di batas, delegasi ke use-case (AuthZ +
// invariant hidup DI SANA, bukan di sini), lalu map hasil/err. Tidak ada SQL, tidak ada aturan
// bisnis di route (Req 2.6, 7.7, 8.1).
//
// Keputusan clean-cutover: GET dihapus. Dalam redesign, baca dashboard berjalan lewat Server
// Component yang memanggil `listEventsForDashboard` langsung di server — bukan `fetch` dari klien.
// GET lama mengembalikan payload gabungan bentuk-lama (venues/event_organizers/exhibitors/pic
// bersarang) untuk `lib/data-client.ts`; konsumen itu memakai `fetch` tak-bertipe, sehingga
// menghapus GET TIDAK memutus `tsc`/`build`. Menyediakan GET minimal yang mengembalikan
// `EventListPage` pun tak akan memuaskan parser lama (bentuknya berbeda total). Jadi penghapusan
// adalah pilihan cutover yang jujur; baca pindah ke RSC.

import { requireCurrentUser } from '@/features/auth'
import { createEvent, listLegacyEventRows } from '@/features/events'
import { eventInputSchema } from '@/domain/event/validation'
import { toErrorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daftar event dalam bentuk legacy (snake_case + embed) untuk halaman klien lama
 * (detail event, detail CIPL) yang memetakan via lib/data-client. Cutover redesign
 * pernah menghapus GET ini; pemanggil klien ternyata masih ada, jadi dikembalikan.
 */
export async function GET() {
  try {
    await requireCurrentUser()
    const rows = await listLegacyEventRows()
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * Buat event. Parse `eventInputSchema` (format + invariant tanggal di Zod), delegasi ke use-case
 * `createEvent` (otorisasi + invariant referensi), kembalikan event tersimpan dengan status 201.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser()
    const input = eventInputSchema.parse(await request.json())
    const event = await createEvent(currentUser, input)
    return NextResponse.json(event, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
