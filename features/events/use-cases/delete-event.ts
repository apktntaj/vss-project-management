import 'server-only'

// Mengapa: use-case tulis "hapus event" — titik penegakan server untuk otorisasi peran + per-objek
// dan untuk aturan "tidak boleh hapus keras bila ada data turunan" (Req 14.3). Penghapusan keras
// hanya sah untuk event tanpa data turunan; event dengan turunan harus dibatalkan atau diarsipkan.
// `import 'server-only'` menjaga batas server/klien (Req 3.2, 20.2).

import { authorize } from '@/features/auth'
import { deleteEvent as deleteEventRow, findEventById, hasDerivedData } from '@/features/events/repository'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'

/**
 * Hapus event secara permanen. Urutan WAJIB:
 * 1. Muat event via `findEventById`; tidak ada → 404 `Event tidak ditemukan.` (Req 14.1).
 * 2. Otorisasi `event:delete` dengan guard per-objek PIC-atau-SUPERVISOR. Peran dulu, lalu guard;
 *    gagal guard → 403 `Hanya PIC event atau supervisor yang dapat melakukan tindakan ini.`
 *    (Req 15.2/15.3/15.4).
 * 3. Cek data turunan: `hasDerivedData` → true → 409 yang mengarahkan ke batal/arsip (Req 14.3).
 * 4. Selain itu hapus baris; route mengembalikan 204 (Req 14.2).
 */
export async function deleteEvent(currentUser: CurrentUser, eventId: string): Promise<void> {
  const event = await findEventById(eventId)
  if (!event) {
    throw new ApiError(404, 'Event tidak ditemukan.')
  }

  await authorize(currentUser, 'event:delete', async () => {
    // PIC kini opsional: event tanpa PIC bisa dihapus siapa pun yang ber-hak hapus
    // (warisan aturan "event lama tanpa PIC bebas dihapus").
    return !event.picId || event.picId === currentUser.id || currentUser.role === 'SUPERVISOR'
  })

  // Data turunan menghalangi hapus keras: arahkan pengguna ke jalur batal/arsip (Req 14.3).
  if (await hasDerivedData(eventId)) {
    throw new ApiError(
      409,
      'Event memiliki data turunan. Batalkan atau arsipkan event alih-alih menghapus.',
    )
  }

  await deleteEventRow(eventId)
}
