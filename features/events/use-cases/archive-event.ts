import 'server-only'

// Mengapa: use-case tulis "arsipkan event" — alternatif non-destruktif dari hapus (Req 14.4/14.5).
// Mengarsipkan hanya mengubah lifecycle ke ARCHIVED dan MEMPERTAHANKAN seluruh data turunan (beda
// dari delete yang menghapus baris). Capability union TIDAK punya `event:archive`; mengarsipkan
// adalah bentuk edit lifecycle, jadi diotorisasi dengan `event:update` + guard PIC/penerima akses/admin.
// `import 'server-only'` menjaga batas server/klien (Req 3.2, 20.2).

import { authorize } from '@/features/auth'
import { eventManagerGuard } from '@/features/events/use-cases/event-guards'
import { findEventById, setEventStatus, type EventRow } from '@/features/events/repository'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'

/**
 * Arsipkan event. Urutan WAJIB:
 * 1. Muat event via `findEventById`; tidak ada → 404 `Event tidak ditemukan.`.
 * 2. Otorisasi `event:update` (arsip = edit lifecycle; tak ada capability khusus arsip) dengan
 *    guard per-objek `eventManagerGuard` (PIC, penerima akses, atau admin) (Req 14.4).
 *
 * Mengembalikan `EventRow` terbaru untuk dikembalikan route 200.
 */
export async function archiveEvent(
  currentUser: CurrentUser,
  eventId: string,
): Promise<EventRow> {
  const existing = await findEventById(eventId)
  if (!existing) {
    throw new ApiError(404, 'Event tidak ditemukan.')
  }

  await authorize(currentUser, 'event:update', eventManagerGuard(currentUser, existing))

  const archived = await setEventStatus(eventId, 'ARCHIVED')
  if (!archived) {
    throw new ApiError(404, 'Event tidak ditemukan.')
  }
  return archived
}
