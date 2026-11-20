import 'server-only'

// Mengapa: guard per-objek tunggal untuk tindakan yang mengubah event (ubah/batal/hapus/arsip) dan
// mengelola aksesnya. Pengelola event = admin atau PIC event. Penerima akses event TIDAK mengelola
// event: akses itu hanya untuk menulis job miliknya (lihat `job-guards.ts`). Keputusan murninya
// (`isEventManager`) ada di `features/auth/write-scope.ts`; `authorize` memanggil guard ini HANYA
// setelah gerbang peran lolos.

import { authorize } from '@/features/auth'
import { isEventManager } from '@/features/auth/write-scope'
import { findEventById, type EventRow } from '@/features/events/repository'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { Capability } from '@/features/auth/capabilities'

export function eventManagerGuard(
  currentUser: CurrentUser,
  event: { id: string; picId: string | null },
): () => Promise<boolean> {
  return async () => isEventManager(currentUser, event.picId)
}

/**
 * Muat event (404 bila tidak ada), lalu `authorize` `capability` + `eventManagerGuard` (403 bila
 * bukan admin/PIC atau peran tidak cukup). Mengembalikan event yang dimuat.
 */
export async function authorizeEventManager(
  currentUser: CurrentUser,
  capability: Capability,
  eventId: string,
): Promise<EventRow> {
  const event = await findEventById(eventId)
  if (!event) {
    throw new ApiError(404, 'Event tidak ditemukan.')
  }
  await authorize(currentUser, capability, eventManagerGuard(currentUser, event))
  return event
}
