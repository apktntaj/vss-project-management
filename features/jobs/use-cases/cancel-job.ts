import 'server-only'

// Perintah "batalkan job": satu-satunya cara job keluar dari alur kerja — job tidak pernah dihapus.
// Alasan wajib (dijaga skema di route) dan dicatat atomik bersama perubahan status (fungsi DB
// `cancel_job`). Setelah batal, semua perintah tulis job menolak dengan 409 (lihat `errors.ts`).

import { cancelJobGuarded, findJobById } from '@/features/jobs/repository'
import {
  STALE_VERSION_MESSAGE,
  assertNotCancelled,
  translateConstraint,
} from '@/features/jobs/use-cases/errors'
import { authorizeJobWrite } from '@/features/jobs/use-cases/job-guards'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { Job } from '@/domain/job/types'
import type { JobCancelInput } from '@/domain/job/validation'

export async function cancelJob(
  currentUser: CurrentUser,
  jobId: string,
  input: JobCancelInput,
): Promise<Job> {
  await authorizeJobWrite(currentUser, 'job:cancel', jobId)
  let cancelled: boolean
  try {
    cancelled = await cancelJobGuarded(jobId, input.version, currentUser.id, input.reason)
  } catch (error) {
    translateConstraint(error)
  }
  const job = await findJobById(jobId)
  if (!job) throw new ApiError(404, 'Job tidak ditemukan.')
  if (!cancelled) {
    assertNotCancelled(job)
    throw new ApiError(409, STALE_VERSION_MESSAGE)
  }
  return job
}
