import 'server-only'

// Mengapa: use-case tulis "buat venue" (master data create-inline). Ia adalah TITIK PENEGAKAN
// server untuk otorisasi — bukan route, bukan komponen. Jalur bypass (POST langsung ke route,
// lewat UI) tetap melewati use-case ini, jadi gerbang `reference:create` harus di sini (Req 7.7).
// `import 'server-only'` sebagai import efektif pertama menjaga batas server/klien (Req 3.2, 20.2).

import { authorize } from '@/features/auth'
import { insertVenue } from '@/features/events/repository'
import type { CurrentUser } from '@/domain/auth/types'
import type { VenueInput, VenueRecord } from '@/domain/event/types'

/**
 * Buat venue baru (create-inline). Urutan WAJIB:
 * 1. Otorisasi `reference:create` SEBELUM tulis apa pun (Req 7.1/7.7) — STAFF/SUPERVISOR; peran
 *    lain 403.
 * 2. Baru persist. Nama kosong/spasi sudah ditolak skema Zod di batas route (Req 12.4); use-case
 *    tetap menjadi titik penegakan otorisasi.
 *
 * Mengembalikan `VenueRecord` tersimpan (dengan id dari DB) — id inilah yang kemudian dirujuk event
 * lewat FK, bukan nilai yang digandakan (Req 12.2/12.3).
 */
export async function createVenue(
  currentUser: CurrentUser,
  input: VenueInput,
): Promise<VenueRecord> {
  await authorize(currentUser, 'reference:create')
  return insertVenue(input)
}
