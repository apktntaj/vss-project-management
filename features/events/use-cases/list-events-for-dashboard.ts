import 'server-only'

// Mengapa: use-case baca untuk dashboard event. Lapisan ini mengorkestrasi otorisasi + repository;
// ia TIDAK menyentuh Supabase langsung (itu milik repository) dan TIDAK memegang aturan presentasi
// (itu milik domain/komponen). `import 'server-only'` sebagai import efektif pertama menjaga modul
// ini — dan kunci service-role yang dijangkau repository-nya — tak pernah ikut ke bundle browser
// (Req 3.2, 20.2). Dipanggil dari Server Component dashboard dan (bila perlu) route handler.

import { authorize } from '@/features/auth'
import { queryEventList } from '@/features/events/repository'
import type { CurrentUser } from '@/domain/auth/types'
import type { EventListPage, EventListQuery } from '@/domain/event/types'

/**
 * Daftar event untuk dashboard. Otorisasi DULU (`event:read` — semua peran boleh baca, Req 7.3),
 * lalu delegasi ke repository yang memfilter sepenuhnya sisi-server (Req 16.1–16.7).
 *
 * Indikator error (Req 16.8): bila query daftar/agregat/attention gagal, repository MELEMPAR —
 * kita biarkan error itu merambat agar route/komponen pemanggil memetakannya ke 503 lewat
 * `toErrorResponse` dan menampilkan indikator kegagalan. Kita TIDAK menelan error lalu merender
 * data parsial (mis. daftar kosong) seolah valid; "gagal memuat" harus terlihat jelas.
 */
export async function listEventsForDashboard(
  currentUser: CurrentUser,
  query: EventListQuery,
): Promise<EventListPage> {
  await authorize(currentUser, 'event:read')
  return queryEventList(query)
}
