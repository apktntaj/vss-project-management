import { internationalJobJenisLabels, type InternationalJobJenis } from '@/domain/job/types'
import type { Job } from '@/lib/data-client'

/** Grup jenis job pada satu event: sub-jenis international + Local + Job lama (taksonomi pra-2026-10-29). */
export type JobJenisGroup = InternationalJobJenis | 'LOCAL' | 'LEGACY'

/** Urutan dasar grup jenis; dipakai sebagai tie-break saat jumlah job sama. */
export const jobJenisOrder: ReadonlyArray<JobJenisGroup> = [
  'TPPB_BC_23',
  'ATA_CARNET',
  'TEMPORARY_IMPORT',
  'PERMANENT_IMPORT',
  'ROAD_SHIPMENT',
  'LOCAL',
  'LEGACY',
]

export function jobJenisKey(job: Job): JobJenisGroup {
  if (job.kind === 'LOCAL') return 'LOCAL'
  // Nilai jenis yang tak dikenal (mis. TEMPORARY pra-taksonomi 2026-10-29) tetap tampil sebagai job lama.
  if (job.internationalJenis && job.internationalJenis in internationalJobJenisLabels)
    return job.internationalJenis
  return 'LEGACY'
}

export function jobJenisLabel(key: JobJenisGroup): string {
  if (key === 'LOCAL') return 'Local'
  if (key === 'LEGACY') return 'Job lama'
  return internationalJobJenisLabels[key]
}

/** Kelompokkan job per jenis dalam urutan jobJenisOrder, grup terbanyak dulu (tie-break: urutan dasar). */
export function groupJobsByJenis(jobs: Job[]): Array<{ key: JobJenisGroup; jobs: Job[] }> {
  const byKey = new Map<JobJenisGroup, Job[]>()
  for (const job of jobs) {
    const key = jobJenisKey(job)
    const bucket = byKey.get(key)
    if (bucket) bucket.push(job)
    else byKey.set(key, [job])
  }
  return jobJenisOrder
    .flatMap((key) => {
      const groupJobs = byKey.get(key)
      return groupJobs ? [{ key, jobs: groupJobs }] : []
    })
    .sort((a, b) => b.jobs.length - a.jobs.length)
}
