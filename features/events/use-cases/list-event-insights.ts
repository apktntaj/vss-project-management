import 'server-only'

// Mengapa: use-case baca untuk panel "Perlu tindakan" + statistik halaman events. Sama gaya
// `listEventsForDashboard`: otorisasi DULU, lalu delegasi murni ke repository — tidak ada SQL di
// sini. `import 'server-only'` menjaga modul (dan repository yang dijangkaunya) tetap sisi server.

import { authorize } from '@/features/auth'
import { queryEventInsights } from '@/features/events/repository'
import type { CurrentUser } from '@/domain/auth/types'
import type { EventInsights } from '@/domain/event/types'

/**
 * Insight operasional untuk staff. Otorisasi `event:read` (semua peran boleh baca), lalu
 * repository menghitung agregat sepenuhnya sisi-server. Error merambat agar halaman menampilkan
 * indikator kegagalan, bukan data parsial.
 */
export async function listEventInsights(currentUser: CurrentUser): Promise<EventInsights> {
  await authorize(currentUser, 'event:read')
  return queryEventInsights()
}
