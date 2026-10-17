import 'server-only'

// Mengapa: use-case baca ringkasan satu event untuk EventCard. Sama seperti use-case daftar, ia
// hanya mengorkestrasi otorisasi + repository; tanpa Supabase langsung, tanpa aturan presentasi.
// `import 'server-only'` sebagai import efektif pertama adalah sabuk pengaman batas server/klien
// (Req 3.2, 20.2).

import { authorize } from '@/features/auth'
import { findEventSummary, type EventSummary } from '@/features/events/repository'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'

/**
 * Ambil ringkasan satu event. Otorisasi `event:read` DULU (Req 7.3), lalu baca repository.
 *
 * - Event tidak ditemukan → repository mengembalikan null (bukan error); kita terjemahkan ke
 *   `ApiError(404, 'Event tidak ditemukan.')` sesuai Error_Contract (Req 4.5).
 * - Kegagalan query nyata → repository MELEMPAR dan kita biarkan merambat → 503 via
 *   `toErrorResponse` (Req 16.8). Tidak merender ringkasan parsial sebagai valid.
 */
export async function getEventSummary(
  currentUser: CurrentUser,
  eventId: string,
): Promise<EventSummary> {
  await authorize(currentUser, 'event:read')

  const summary = await findEventSummary(eventId)
  if (!summary) {
    throw new ApiError(404, 'Event tidak ditemukan.')
  }
  return summary
}
