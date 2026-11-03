import 'server-only'

// Mengapa: guard per-objek tunggal untuk tindakan yang mengubah event (ubah/batal/hapus/arsip) dan
// mengelola aksesnya. Pengelola event = admin, PIC event, atau penerima akses yang diberikan PIC.
// `authorize` memanggil guard ini HANYA setelah gerbang peran lolos.

import { hasEventAccess } from '@/features/events/repository'
import type { CurrentUser } from '@/domain/auth/types'

export function eventManagerGuard(
  currentUser: CurrentUser,
  event: { id: string; picId: string | null },
): () => Promise<boolean> {
  return async () =>
    currentUser.isAdmin ||
    event.picId === currentUser.id ||
    (await hasEventAccess(event.id, currentUser.id))
}
