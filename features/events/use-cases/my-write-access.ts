import 'server-only'

// Mengapa: use-case baca "akses tulis saya" — kaitan pengguna login dengan event (PIC/penerima akses)
// dan jenis job yang ia pegang, sebagai bekal UI menentukan tombol tulis. Hanya data milik sesi
// sendiri; tidak menerima parameter userId.

import { authorize, findHandledJobJenis } from '@/features/auth'
import { mergeEventAccess, type MyWriteAccess } from '@/features/auth/write-scope'
import { listEventIdsByPic, listGrantedEventIds } from '@/features/events/repository'
import type { CurrentUser } from '@/domain/auth/types'
import type { JobJenis } from '@/domain/job/types'

// Logika sama dengan `loadHandledJenis` di job-guards: hanya spesialis non-admin memegang jenis.
async function loadHandledJenis(currentUser: CurrentUser): Promise<readonly JobJenis[]> {
  if (!currentUser.isAdmin && currentUser.role === 'SPESIALIS') {
    return findHandledJobJenis(currentUser.id)
  }
  return []
}

/** Kaitan pengguna login dengan event + jenis job yang ia pegang. */
export async function getMyWriteAccess(currentUser: CurrentUser): Promise<MyWriteAccess> {
  await authorize(currentUser, 'event:read')

  const [picIds, grantedIds, handledJobJenis] = await Promise.all([
    listEventIdsByPic(currentUser.id),
    listGrantedEventIds(currentUser.id),
    loadHandledJenis(currentUser),
  ])
  return { events: mergeEventAccess(picIds, grantedIds), handledJobJenis }
}
