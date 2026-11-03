import 'server-only'

// Mengapa: use-case kelola hak akses event (co-PIC). Hanya PIC event atau admin yang boleh
// melihat/memberi/mencabut; penerima akses TIDAK dapat meneruskan akses. Penerima dapat
// mengubah/membatalkan/menghapus/mengarsipkan event seperti PIC (lihat `eventManagerGuard`),
// sementara `pic_id` tetap milik PIC.

import { authorize, listWorkspaceMembers } from '@/features/auth'
import {
  deleteEventAccess,
  findEventById,
  insertEventAccess,
  isActiveWorkspaceMember,
  listEventGrantees,
  type EventGrantee,
  type EventRow,
} from '@/features/events/repository'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'

export type EventAccessView = {
  grantees: EventGrantee[]
  candidates: { id: string; fullName: string }[]
}

async function authorizeManage(currentUser: CurrentUser, eventId: string): Promise<EventRow> {
  const event = await findEventById(eventId)
  if (!event) {
    throw new ApiError(404, 'Event tidak ditemukan.')
  }
  await authorize(
    currentUser,
    'event:access:manage',
    async () => currentUser.isAdmin || event.picId === currentUser.id,
  )
  return event
}

/** Beri `userId` akses kelola event. Target harus anggota workspace aktif. */
export async function grantEventAccess(
  currentUser: CurrentUser,
  eventId: string,
  userId: string,
): Promise<void> {
  const event = await authorizeManage(currentUser, eventId)

  if (userId === event.picId) {
    throw new ApiError(400, 'PIC event sudah memiliki akses penuh.')
  }
  if (!(await isActiveWorkspaceMember(userId))) {
    throw new ApiError(400, 'Pengguna bukan anggota workspace.')
  }
  await insertEventAccess(eventId, userId, currentUser.id)
}

/** Cabut akses kelola event dari `userId`. */
export async function revokeEventAccess(
  currentUser: CurrentUser,
  eventId: string,
  userId: string,
): Promise<void> {
  await authorizeManage(currentUser, eventId)
  await deleteEventAccess(eventId, userId)
}

/** Penerima akses saat ini + calon penerima (anggota aktif selain PIC dan yang sudah diberi). */
export async function listEventAccess(
  currentUser: CurrentUser,
  eventId: string,
): Promise<EventAccessView> {
  const event = await authorizeManage(currentUser, eventId)
  const [grantees, members] = await Promise.all([listEventGrantees(eventId), listWorkspaceMembers()])
  const granted = new Set(grantees.map((g) => g.userId))
  return {
    grantees,
    candidates: members.filter((m) => m.id !== event.picId && !granted.has(m.id)),
  }
}
