import 'server-only'

// Mengapa: surat permohonan Kanwil dan form rincian barang dibuat dari job yang sama dan butuh
// data yang sama (job, event, pengusaha TPPB pada venue event, exhibitor). Satu pemuat memastikan
// otorisasi dan guard (hanya job International non-batal) tidak berbeda antar-dokumen.

import { findVenueTppbProfile } from '@/features/events/repository'
import { getEventSummary } from '@/features/events/use-cases/get-event-summary'
import { listEventExhibitors } from '@/features/exhibitors/use-cases/exhibitors'
import { getJob } from '@/features/jobs/use-cases/read-jobs'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { VenueTppbProfile } from '@/domain/event/types'
import type { Exhibitor } from '@/domain/exhibitor/types'
import type { Job } from '@/domain/job/types'
import type { KanwilEventInfo } from '@/lib/kanwil-letter'

export type KanwilDocumentContext = {
  job: Job
  event: KanwilEventInfo
  venue: VenueTppbProfile
  exhibitors: Map<string, Exhibitor>
}

export async function loadKanwilDocumentContext(
  currentUser: CurrentUser,
  jobId: string,
): Promise<KanwilDocumentContext> {
  const job = await getJob(currentUser, jobId)
  if (job.kind !== 'INTERNATIONAL') throw new ApiError(400, 'Surat Kanwil hanya tersedia untuk job International.')
  if (job.status === 'CANCELLED') throw new ApiError(409, 'Job yang dibatalkan tidak dapat dibuatkan surat Kanwil.')

  const [summary, exhibitors] = await Promise.all([
    getEventSummary(currentUser, job.eventId),
    listEventExhibitors(currentUser, job.eventId),
  ])
  if (!summary.venueId) throw new ApiError(400, 'Event belum punya venue. Isi venue event terlebih dahulu.')
  const venue = await findVenueTppbProfile(summary.venueId)
  if (!venue) throw new ApiError(404, 'Venue event tidak ditemukan.')

  return {
    job,
    event: {
      name: summary.name,
      alias: summary.alias,
      organizerName: summary.eventOrganizerName,
      startsOn: summary.startsOn,
      endsOn: summary.endsOn,
    },
    venue,
    exhibitors: new Map(exhibitors.map((exhibitor) => [exhibitor.id, exhibitor])),
  }
}
