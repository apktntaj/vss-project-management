import { jobContext, jobContextLabels, type JobContextKind } from '@/lib/job-context'
import type { Job } from '@/domain/job/types'

// Penanda cepat jenis job; sengaja bukan hijau/merah/kuning/oranye agar tidak tertukar dengan badge
// status atau peringatan. Ditaruh di components/ (bukan lib/) karena Tailwind hanya memindai
// app/, components/, features/.
const BADGE_CLASSES: Record<JobContextKind, string> = {
  EVENT: 'bg-sky-100 text-sky-800',
  GENERAL_CARGO: 'bg-indigo-100 text-indigo-800',
  PROJECT: 'bg-fuchsia-100 text-fuchsia-800',
}

/** Badge jenis job (Event / Genco / Project), dipakai di daftar dan header detail job. */
export function JobContextBadge({ job }: { job: Pick<Job, 'eventId'> }) {
  const kind = jobContext(job).kind
  return (
    <span
      className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_CLASSES[kind]}`}
    >
      {jobContextLabels[kind]}
    </span>
  )
}
