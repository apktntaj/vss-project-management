import 'server-only'

// Mengapa: use-case tulis "perbarui event" — titik penegakan server untuk otorisasi + invariant
// referensi pada edit. Invariant tanggal `endsOn >= startsOn` ditegakkan skema Zod
// (`eventInputSchema.superRefine`) di batas route, jadi use-case menerima input yang sudah valid
// bentuknya; tetapi eksistensi referensi tetap harus dicek ulang karena referensi bisa saja dihapus
// sejak event dibuat (Req 11.3/12.4). `import 'server-only'` menjaga batas server/klien (Req 3.2).

import { authorize } from '@/features/auth'
import {
  checkReferences,
  findEventById,
  updateEvent as updateEventRow,
  type EventRow,
} from '@/features/events/repository'
import { validateEventReferences } from '@/domain/event/validation'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { EventInput } from '@/domain/event/types'

/**
 * Perbarui event. Urutan WAJIB:
 * 1. Otorisasi `event:update` (Req 11.1) — STAFF/SUPERVISOR; peran lain 403.
 * 2. Muat event via `findEventById`; tidak ada → 404 `Event tidak ditemukan.` (Req 11.2).
 * 3. Cek referensi lagi (venue/EO/PIC harus tetap ada pada edit) lewat repository +
 *    validator domain murni; invalid → 400 pesan Indonesia (Req 11.3).
 * 4. Tulis via `updateEvent` repository (menyetel `updated_at`, Req 11.4). Bila repository
 *    mengembalikan null (race: event terhapus di antara load dan tulis) → 404.
 *
 * Mengembalikan `EventRow` terbaru untuk dikembalikan route 200.
 */
export async function updateEvent(
  currentUser: CurrentUser,
  eventId: string,
  input: EventInput,
): Promise<EventRow> {
  await authorize(currentUser, 'event:update')

  const existing = await findEventById(eventId)
  if (!existing) {
    throw new ApiError(404, 'Event tidak ditemukan.')
  }

  const references = await checkReferences(input)
  const validation = validateEventReferences(references)
  if (!validation.ok) {
    throw new ApiError(400, validation.issues[0].message)
  }

  const updated = await updateEventRow(eventId, input)
  // Race: event dihapus antara load dan tulis → perlakukan sebagai tidak ditemukan.
  if (!updated) {
    throw new ApiError(404, 'Event tidak ditemukan.')
  }
  return updated
}
