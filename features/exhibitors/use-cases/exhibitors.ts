import 'server-only'

// Use-case exhibitor: daftar per event, daftarkan (bisa batch dari scan CIPL), ubah data.
// Menulis exhibitor: PIC event/admin langsung; selain itu hanya lewat job milik pengguna (`viaJobId`)
// di event yang sama, dan untuk ubah, exhibitor harus tercantum di job itu.

/** Muat job perantara, pastikan di event itu dan belum batal, lalu izinkan `job:update` (404/400/409/403). */
async function authorizeViaJob(
  currentUser: CurrentUser,
  jobId: string,
  eventId: string,
): Promise<Job> {
  const job = await findJobById(jobId)
  if (!job) throw new ApiError(404, 'Job tidak ditemukan.')
  if (job.eventId !== eventId) throw new ApiError(400, 'Job tidak berada di event exhibitor ini.')
  assertNotCancelled(job)
  await authorizeLoadedJobWrite(currentUser, 'job:update', job)
  return job
}

async function authorizeExhibitorViaJob(
  currentUser: CurrentUser,
  exhibitor: Exhibitor,
  viaJobId: string,
): Promise<void> {
  const job = await findJobById(viaJobId)
  if (!job) throw new ApiError(404, 'Job tidak ditemukan.')
  if (job.eventId !== exhibitor.eventId) {
    throw new ApiError(400, 'Job tidak berada di event exhibitor ini.')
  }
  assertNotCancelled(job)
  const scope = currentUser.isAdmin
    ? 'ALL'
    : jobWriteScope(currentUser, 'job:update', await loadEventRelation(currentUser, job.eventId))
  const verdict = exhibitorUpdateVerdict(
    scope,
    currentUser.id,
    job.createdById,
    await isExhibitorLinkedToJob(exhibitor.id, job.id),
  )
  if (verdict !== 'ALLOWED') throw new ApiError(403, exhibitorUpdateMessage(scope, verdict))
}

import { authorize } from '@/features/auth'
import {
  exhibitorUpdateMessage,
  exhibitorUpdateVerdict,
  isEventManager,
  jobWriteScope,
} from '@/features/auth/write-scope'
import { findEventById } from '@/features/events/repository'
import {
  findExhibitorById,
  insertExhibitors,
  listExhibitorsByEvent,
  updateExhibitorRow,
  type ExhibitorWritableColumns,
} from '@/features/exhibitors/repository'
import { findJobById, isExhibitorLinkedToJob } from '@/features/jobs/repository'
import { assertNotCancelled } from '@/features/jobs/use-cases/errors'
import { authorizeLoadedJobWrite, loadEventRelation } from '@/features/jobs/use-cases/job-guards'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { Job } from '@/domain/job/types'
import type { Exhibitor } from '@/domain/exhibitor/types'
import type { ExhibitorCreateInput, ExhibitorUpdateInput } from '@/domain/exhibitor/validation'

export async function listEventExhibitors(
  currentUser: CurrentUser,
  eventId: string,
): Promise<Exhibitor[]> {
  await authorize(currentUser, 'event:read')
  return listExhibitorsByEvent(eventId)
}

export async function createExhibitors(
  currentUser: CurrentUser,
  eventId: string,
  inputs: ExhibitorCreateInput[],
  viaJobId: string | null,
): Promise<Exhibitor[]> {
  const event = await findEventById(eventId)
  if (!event) throw new ApiError(404, 'Event tidak ditemukan.')
  await authorize(currentUser, 'exhibitor:write')
  if (!isEventManager(currentUser, event.picId)) {
    if (viaJobId === null) {
      throw new ApiError(
        403,
        'Hanya PIC event atau admin yang dapat mengelola exhibitor event. Tambahkan exhibitor lewat CIPL job Anda.',
      )
    }
    await authorizeViaJob(currentUser, viaJobId, eventId)
  }
  return insertExhibitors(eventId, inputs, currentUser.id)
}

export async function updateExhibitor(
  currentUser: CurrentUser,
  exhibitorId: string,
  patch: ExhibitorUpdateInput,
  viaJobId: string | null,
): Promise<Exhibitor> {
  const current = await findExhibitorById(exhibitorId)
  if (!current) throw new ApiError(404, 'Exhibitor tidak ditemukan.')
  const event = await findEventById(current.eventId)
  await authorize(currentUser, 'exhibitor:write')
  if (!(event && isEventManager(currentUser, event.picId))) {
    if (viaJobId === null) {
      throw new ApiError(
        403,
        'Hanya PIC event atau admin yang dapat mengelola exhibitor event. Ubah exhibitor lewat CIPL job Anda.',
      )
    }
    await authorizeExhibitorViaJob(currentUser, current, viaJobId)
  }

  const kind = patch.kind ?? current.kind
  const npwp = patch.npwp !== undefined ? patch.npwp : current.npwp
  if (kind === 'INTERNATIONAL' && npwp) {
    throw new ApiError(400, 'NPWP hanya untuk exhibitor lokal.')
  }

  const columns: ExhibitorWritableColumns = {}
  if (patch.name !== undefined) columns.name = patch.name
  if (patch.kind !== undefined) columns.kind = patch.kind
  if (patch.npwp !== undefined) columns.npwp = patch.npwp
  // Exhibitor yang beralih ke internasional kehilangan NPWP-nya.
  if (kind === 'INTERNATIONAL' && current.npwp) columns.npwp = null
  if (patch.contact !== undefined) columns.contact = patch.contact
  if (patch.hall !== undefined) columns.hall = patch.hall
  if (patch.booth !== undefined) columns.booth = patch.booth

  const updated = await updateExhibitorRow(exhibitorId, columns)
  if (!updated) throw new ApiError(404, 'Exhibitor tidak ditemukan.')
  return updated
}
