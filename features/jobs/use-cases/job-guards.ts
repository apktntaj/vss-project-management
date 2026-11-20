import 'server-only'

// Mengapa: otorisasi tulis job = peran + kaitan pengguna dengan event + pemilik job. Keputusannya
// MURNI dan hidup di `features/auth/write-scope.ts` (dipakai juga UI); file ini hanya memuat data
// yang dibutuhkan keputusan itu (event, baris akses, jenis yang dipegang spesialis) lalu melempar
// 404/403. Admin selalu lolos tanpa query. PIC event menulis semua job di event-nya; penerima
// akses (CS/Spesialis) hanya membuat job dan menulis job MILIKNYA di event itu; spesialis hanya
// boleh membuat job berjenis yang ia pegang. Aturan lampiran: sama dengan ubah job + job belum batal.

import { findHandledJobJenis } from '@/features/auth'
import {
  canCreateJob,
  canWriteJob,
  eventRelation,
  isJenisAllowed,
  jobWriteDenial,
  jobWriteScope,
  type EventRelation,
  type JobWriteCapability,
} from '@/features/auth/write-scope'
import { findEventById, hasEventAccess } from '@/features/events/repository'
import { findJobById } from '@/features/jobs/repository'
import { assertNotCancelled } from '@/features/jobs/use-cases/errors'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { Job, JobJenis } from '@/domain/job/types'

/** Kaitan pengguna dengan satu event menurut storage; event tak ditemukan = 'NONE. */
export async function loadEventRelation(currentUser: CurrentUser, eventId: string): Promise<EventRelation> {
  const event = await findEventById(eventId)
  if (!event) return 'NONE'
  return eventRelation(currentUser.id, event.picId, await hasEventAccess(eventId, currentUser.id))
}

/** Jenis yang dipegang pengguna; query hanya untuk spesialis non-admin. */
async function loadHandledJenis(currentUser: CurrentUser): Promise<readonly JobJenis[]> {
  if (!currentUser.isAdmin && currentUser.role === 'SPESIALIS') {
    return findHandledJobJenis(currentUser.id)
  }
  return []
}

/** Izinkan membuat job berjenis `jenis` di event, atau lempar 403. */
export async function authorizeJobCreateInEvent(
  currentUser: CurrentUser,
  eventId: string,
  jenis: JobJenis | null,
): Promise<void> {
  if (currentUser.isAdmin) return
  const scope = jobWriteScope(currentUser, 'job:create', await loadEventRelation(currentUser, eventId))
  if (!canCreateJob(scope)) throw new ApiError(403, jobWriteDenial(scope))
  if (!isJenisAllowed(currentUser, await loadHandledJenis(currentUser), jenis)) {
    throw new ApiError(403, 'Anda hanya dapat membuat job dengan jenis yang Anda pegang.')
  }
}

/** Izinkan `capability` pada job yang sudah dimuat, atau lempar 403. */
export async function authorizeLoadedJobWrite(
  currentUser: CurrentUser,
  capability: JobWriteCapability,
  job: Job,
): Promise<void> {
  if (currentUser.isAdmin) return
  const scope = jobWriteScope(
    currentUser,
    capability,
    await loadEventRelation(currentUser, job.eventId),
  )
  if (!canWriteJob(scope, currentUser.id, job.createdById)) {
    throw new ApiError(403, jobWriteDenial(scope))
  }
}

/** Izinkan `capability` pada job `jobId`, atau lempar 404/403. */
export async function authorizeJobWrite(
  currentUser: CurrentUser,
  capability: JobWriteCapability,
  jobId: string,
): Promise<void> {
  if (currentUser.isAdmin) return
  const job = await findJobById(jobId)
  if (!job) throw new ApiError(404, 'Job tidak ditemukan.')
  await authorizeLoadedJobWrite(currentUser, capability, job)
}

/**
 * Lampiran baru tidak boleh ditambahkan ke job yang sudah batal. Job yang tak ditemukan dibiarkan
 * lolos di sini; pemeriksaan keberadaan milik penyimpanan lampiran.
 */
async function assertJobAcceptsAttachments(jobId: string): Promise<void> {
  const job = await findJobById(jobId)
  if (job) assertNotCancelled(job)
}

/** Izinkan menambah lampiran: aturan ubah job + job tidak batal (404/403/409). */
export async function authorizeJobAttachmentWrite(
  currentUser: CurrentUser,
  jobId: string,
): Promise<void> {
  await authorizeJobWrite(currentUser, 'job:update', jobId)
  await assertJobAcceptsAttachments(jobId)
}
