import 'server-only'

// Mengapa: use-case tulis "buat event organizer" (master data create-inline). Titik penegakan
// server untuk otorisasi — jalur bypass (POST langsung ke route) tetap melewatinya, jadi gerbang
// `reference:create` harus di sini (Req 7.7). `import 'server-only'` menjaga batas server/klien.

import { authorize } from '@/features/auth'
import { insertEventOrganizer } from '@/features/events/repository'
import type { CurrentUser } from '@/domain/auth/types'
import type { EventOrganizerInput, EventOrganizerRecord } from '@/domain/event/types'

/**
 * Buat event organizer baru (create-inline). Urutan WAJIB:
 * 1. Otorisasi `reference:create` SEBELUM tulis apa pun (Req 7.1/7.7) — STAFF/SUPERVISOR; lain 403.
 * 2. Baru persist. Nama kosong/spasi sudah ditolak skema Zod di batas route (Req 12.4).
 *
 * Mengembalikan `EventOrganizerRecord` tersimpan (dengan id dari DB) — id inilah yang dirujuk event
 * lewat FK (Req 12.2/12.3).
 */
export async function createEventOrganizer(
  currentUser: CurrentUser,
  input: EventOrganizerInput,
): Promise<EventOrganizerRecord> {
  await authorize(currentUser, 'reference:create')
  return insertEventOrganizer(input)
}
