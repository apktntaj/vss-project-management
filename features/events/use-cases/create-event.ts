import 'server-only'

// Mengapa: use-case tulis "buat event". Ia adalah TITIK PENEGAKAN server untuk otorisasi +
// invariant referensi — bukan route, bukan komponen. Jalur bypass (POST langsung ke route, lewat
// UI) tetap melewati use-case ini, jadi semua aturan harus di sini (Req 7.7). `import 'server-only'`
// sebagai import efektif pertama menjaga batas server/klien (Req 3.2, 20.2).

import { authorize } from '@/features/auth'
import { checkReferences, insertEvent, type EventRow } from '@/features/events/repository'
import { validateEventReferences } from '@/domain/event/validation'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { EventInput } from '@/domain/event/types'

/**
 * Buat event baru. Urutan WAJIB:
 * 1. Otorisasi `event:create` SEBELUM tulis apa pun (Req 7.1/7.7) — STAFF/SUPERVISOR; peran lain 403.
 * 2. Cek eksistensi referensi di repository (`checkReferences`) lalu putuskan valid/tidak dengan
 *    validator domain MURNI (`validateEventReferences`) (Req 10.6/12.4). Referensi tak valid → 400
 *    dengan pesan Indonesia. Validator mengumpulkan SEMUA issue; kita surface pesan issue pertama
 *    sesuai gaya Error_Contract (`toErrorResponse` juga memakai issue pertama untuk Zod).
 * 3. Baru persist. `status` awal diserahkan ke default DB (ACTIVE). Alias sudah ter-trim/null oleh
 *    skema Zod di batas route; use-case menerima `EventInput` (alias: string | null) dan persist
 *    apa adanya.
 *
 * Mengembalikan `EventRow` yang tersimpan (dengan id/timestamp dari DB) untuk dikembalikan route 201.
 */
export async function createEvent(
  currentUser: CurrentUser,
  input: EventInput,
): Promise<EventRow> {
  await authorize(currentUser, 'event:create')

  const references = await checkReferences(input)
  const validation = validateEventReferences(references)
  if (!validation.ok) {
    // Referensi tak valid adalah kesalahan input pengguna → 400, bukan 503. Ambil pesan issue
    // pertama agar konsisten dengan cara `toErrorResponse` memetakan ZodError.
    throw new ApiError(400, validation.issues[0].message)
  }

  return insertEvent(input, currentUser.id)
}
