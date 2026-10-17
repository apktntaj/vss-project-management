import 'server-only'

// Mengapa: use-case tulis "batalkan event" — titik penegakan server untuk otorisasi peran + per-objek
// DAN invariant bijection CANCELLED↔cancellation. Alasan pembatalan kosong/spasi sudah ditolak skema
// `cancelEventSchema` di batas route (400 'Alasan pembatalan wajib diisi.'), tetapi sebagai titik
// penegakan terhadap bypass UI, use-case tetap menerima `reason` yang sudah di-parse route. Guard
// per-objek: hanya PIC event atau SUPERVISOR yang boleh membatalkan (Req 15.2–15.4).
// `import 'server-only'` menjaga batas server/klien (Req 3.2, 20.2).

import { authorize } from '@/features/auth'
import { findEventById, insertCancellation, setEventStatus } from '@/features/events/repository'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'

/**
 * Batalkan event. Urutan WAJIB:
 * 1. Muat event via `findEventById` DULU — perlu `picId` untuk guard per-objek dan untuk 404
 *    `Event tidak ditemukan.` bila tidak ada (Req 13.2).
 * 2. Otorisasi `event:cancel` dengan guard per-objek `picId === currentUser.id ||
 *    role === 'SUPERVISOR'`. Authorizer memeriksa peran DULU; guard hanya dievaluasi bila peran
 *    lolos, dan kegagalan guard → 403 pesan PIC/supervisor (Req 15.2/15.3/15.4).
 * 3. Pada sukses: set `status='CANCELLED'` DAN catat TEPAT SATU baris `event_cancellations`
 *    (alasan, pelaku, waktu di default DB). Kolom `event_id` UNIQUE menjaga bijection
 *    CANCELLED↔cancellation di level DB (Req 13.5).
 *
 * Catatan urutan tulis: transisi status dulu, lalu insert cancellation. Bila insert cancellation
 * gagal, error merambat → 503; status sudah berubah tetapi tanpa baris cancellation. Konstrain
 * UNIQUE DB menjaga TIDAK ADA duplikasi cancellation; pembatalan ulang hanya menambah baris bila
 * belum ada. Ini kompromi tanpa transaksi lintas-statement di klien; bijection tetap dijaga DB.
 */
export async function cancelEvent(
  currentUser: CurrentUser,
  eventId: string,
  reason: string,
): Promise<void> {
  const event = await findEventById(eventId)
  if (!event) {
    throw new ApiError(404, 'Event tidak ditemukan.')
  }

  // Guard per-objek: pemilik PIC atau supervisor. Dievaluasi HANYA setelah peran lolos.
  await authorize(currentUser, 'event:cancel', async () => {
    return event.picId === currentUser.id || currentUser.role === 'SUPERVISOR'
  })

  await setEventStatus(eventId, 'CANCELLED')
  await insertCancellation({ eventId, reason, cancelledById: currentUser.id })
}
