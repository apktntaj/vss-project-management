import 'server-only'

import { authorize } from '@/features/auth'
import { findJobById, listJobSummaries, listJobs } from '@/features/jobs/repository'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { Job, JobSummary } from '@/domain/job/types'
import type { JobListQuery } from '@/domain/job/validation'

/** Daftar job tersaring di SQL; `view=summary` hanya kolom label untuk dropdown/tiket. */
export async function listJobsForUser(
  currentUser: CurrentUser,
  query: JobListQuery,
): Promise<Job[] | JobSummary[]> {
  await authorize(currentUser, 'job:read')
  const { view, ...filter } = query
  return view === 'summary' ? listJobSummaries(filter) : listJobs(filter)
}

export async function getJob(currentUser: CurrentUser, jobId: string): Promise<Job> {
  await authorize(currentUser, 'job:read')
  const job = await findJobById(jobId)
  if (!job) throw new ApiError(404, 'Job tidak ditemukan.')
  return job
}
