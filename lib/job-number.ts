import type { LocalJob } from '@/lib/data-client'

/** Maps jobs to their explicitly assigned business numbers; blank numbers stay blank. */
export function buildJobNomor(jobs: LocalJob[]): Map<string, string> {
  const nomorByJobId = new Map<string, string>()
  for (const job of jobs) {
    const jobNumber = job.jobNumber.trim()
    if (jobNumber) nomorByJobId.set(job.id, jobNumber)
  }
  return nomorByJobId
}
