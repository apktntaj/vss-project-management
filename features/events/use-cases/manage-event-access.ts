import 'server-only'

// Mengapa: use-case kelola akses event. Hanya PIC event atau admin yang boleh melihat/memberi/
// mencabut; penerima akses TIDAK dapat meneruskan akses. Akses event hanya diberikan kepada CS atau
// Spesialis (bukan admin, bukan Finance) dan hanya berguna untuk menulis job miliknya di event itu;
// penerima akses tidak mengelola event (lihat `event-guards.ts` dan `job-guards.ts`).

import { listGrantCandidates } from '@/features/auth'
import { grantTargetError } from '@/features/auth/write-scope'
import {
  deleteEventAccess,
  findActiveMember,
  insertEventAccess,
  listEventGrantees,
  type EventGrantee,
} from '@/features/events/repository'
import { authorizeEventManager } from '@/features/events/use-cases/event-guards'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'

export type EventAccessView = {
  grantees: EventGrantee[]
  candidates: { id: string; fullName: string }[]
}

/** Beri `userId` akses event. Target harus anggota aktif non-admin berperan CS atau Spesialis. */
export async function grantEventAccess(
  currentUser: CurrentUser,
  eventId: string,
  userId: string,
): Promise<void> {
  const event = await authorizeEventManager(currentUser, 'event:access:manage', eventId)
  const error = grantTargetError(await findActiveMember(userId), event.picId, userId)
  if (error !== null) {
    throw new ApiError(400, error)
  }
  await insertEventAccess(eventId, userId, currentUser.id)
}

/** Cabut akses event dari `userId`. */
export async function revokeEventAccess(
  currentUser: CurrentUser,
  eventId: string,
  userId: string,
): Promise<void> {
  await authorizeEventManager(currentUser, 'event:access:manage', eventId)
  await deleteEventAccess(eventId, userId)
}

/** Penerima akses saat ini + calon penerima (CS/Spesialis non-admin selain PIC dan yang sudah diberi). */
export async function listEventAccess(
  currentUser: CurrentUser,
  eventId: string,
): Promise<EventAccessView> {
  const event = await authorizeEventManager(currentUser, 'event:access:manage', eventId)
  const [grantees, members] = await Promise.all([listEventGrantees(eventId), listGrantCandidates()])
  const granted = new Set(grantees.map((g) => g.userId))
  return {
    grantees,
    candidates: members.filter((m) => m.id !== event.picId && !granted.has(m.id)),
  }
}
