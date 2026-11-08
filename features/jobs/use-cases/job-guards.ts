import 'server-only'

// Mengapa: otorisasi tulis job punya dua jalur. (1) Peran luas (STAFF/OPERATIONS/DOCUMENT_ASSISTANT)
// atau admin lolos lewat tabel kapabilitas. (2) Pengelola event — PIC (peran CS) atau penerima
// akses yang ia beri — boleh membuat/mengubah/menghapus job DI EVENT ITU saja, apa pun perannya.
// Jalur (2) hanya dievaluasi bila peran tidak cukup, sehingga peran luas tidak membayar query.

import { can, type Capability } from '@/features/auth'
import { findEventById } from '@/features/events/repository'
import { eventManagerGuard } from '@/features/events/use-cases/event-guards'
import { findJobById } from '@/features/jobs/repository'
import { assertNotCancelled } from '@/features/jobs/use-cases/errors'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'

export type JobWriteCapability = Extract<Capability, 'job:create' | 'job:update' | 'job:cancel'>

/** Otorisasi tulis job pada event tertentu (dipakai saat job belum ada: create). */
export async function authorizeJobWriteInEvent(
  currentUser: CurrentUser,
  capability: JobWriteCapability,
  eventId: string,
): Promise<void> {
  if (currentUser.isAdmin || can(currentUser.role, capability)) return
  const event = await findEventById(eventId)
  if (event && (await eventManagerGuard(currentUser, event)())) return
  throw new ApiError(403, 'Anda tidak memiliki izin untuk melakukan tindakan ini.')
}

/** Otorisasi tulis job yang sudah ada; event-nya diturunkan dari job (hanya dimuat bila perlu). */
export async function authorizeJobWrite(
  currentUser: CurrentUser,
  capability: JobWriteCapability,
  jobId: string,
): Promise<void> {
  if (currentUser.isAdmin || can(currentUser.role, capability)) return
  const job = await findJobById(jobId)
  if (!job) throw new ApiError(404, 'Job tidak ditemukan.')
  await authorizeJobWriteInEvent(currentUser, capability, job.eventId)
}

/**
 * Lampiran baru tidak boleh ditambahkan ke job yang sudah batal. Job yang tak ditemukan dibiarkan
 * lolos di sini; pemeriksaan keberadaan milik penyimpanan lampiran.
 */
export async function assertJobAcceptsAttachments(jobId: string): Promise<void> {
  const job = await findJobById(jobId)
  if (job) assertNotCancelled(job)
}
