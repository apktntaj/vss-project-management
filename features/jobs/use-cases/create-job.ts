import 'server-only'

// Buat aggregate Job (satu kiriman). Invariant lintas-aggregate dijaga di sini + constraint DB:
// event harus ada; pihak (agent ATAU exhibitor) harus ada — agent otomatis terdaftar sebagai
// peserta event, exhibitor harus dari event yang sama. Local & Road Shipment selalu exhibitor.

import { authorize } from '@/features/auth'
import { findEventById } from '@/features/events/repository'
import {
  ensureEventAgent,
  exhibitorBelongsToEvent,
  findAgentName,
  insertJob,
} from '@/features/jobs/repository'
import { translateConstraint } from '@/features/jobs/use-cases/errors'
import { emptyOperationalDetails } from '@/domain/job/operational'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { Job } from '@/domain/job/types'
import type { JobCreateInput } from '@/domain/job/validation'

export async function createJob(currentUser: CurrentUser, input: JobCreateInput): Promise<Job> {
  await authorize(currentUser, 'job:create')

  if (!(await findEventById(input.eventId))) throw new ApiError(400, 'Event tidak ditemukan.')
  if (input.agentId && (await findAgentName(input.agentId)) === null) {
    throw new ApiError(400, 'Agent tidak ditemukan.')
  }
  if (input.exhibitorId && !(await exhibitorBelongsToEvent(input.exhibitorId, input.eventId))) {
    throw new ApiError(400, 'Exhibitor tidak terdaftar di event ini.')
  }
  if (input.agentId) await ensureEventAgent(input.eventId, input.agentId, currentUser.id)

  try {
    return await insertJob({
      event_id: input.eventId,
      kind: input.kind,
      international_jenis: input.kind === 'INTERNATIONAL' ? input.internationalJenis : null,
      // Road shipment selalu lewat darat; jalur lain diisi operator.
      transport_mode: input.internationalJenis === 'ROAD_SHIPMENT' ? 'ROAD' : input.transportMode,
      agent_id: input.agentId,
      exhibitor_id: input.exhibitorId,
      created_by_id: currentUser.id,
      operational: emptyOperationalDetails(),
    })
  } catch (error) {
    translateConstraint(error)
  }
}
