import 'server-only'

// Job turunan per dokumen BC (BC 2.5 disposal / BC 3.0 re-ekspor). Dibuat otomatis setelah CIPL
// job masuk disimpan — aturan tahap murni ada di `domain/job/stages.ts`, file ini hanya I/O + guard.
// Sistem tidak pernah membatalkan job turunan otomatis; tahap yang pernah ada (termasuk yang batal)
// tidak dibuat ulang otomatis — pembuatan ulang adalah keputusan operator lewat `createStageJob`.

import {
  JobConstraintError,
  findJobById,
  insertJob,
  listDerivedJobs,
} from '@/features/jobs/repository'
import {
  assertNotCancelled,
  translateConstraint,
} from '@/features/jobs/use-cases/errors'
import { authorizeJobWriteInEvent } from '@/features/jobs/use-cases/job-guards'
import { emptyOperationalDetails } from '@/domain/job/operational'
import { expectedDerivedStages } from '@/domain/job/stages'
import { derivedStagesOf, jobStageLabel } from '@/domain/job/regime'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'
import type { DerivedJobStage, Job } from '@/domain/job/types'

// Kolom yang job turunan warisi dari job masuknya saat dibuat; selebihnya (pihak tagihan, moda)
// bebas diubah operator karena tiap job tetap satu tagihan sendiri.
async function insertStageJob(
  currentUser: CurrentUser,
  inbound: Job,
  stage: DerivedJobStage,
): Promise<Job> {
  try {
    return await insertJob({
      event_id: inbound.eventId,
      kind: inbound.kind,
      international_jenis: inbound.internationalJenis,
      transport_mode: inbound.transportMode,
      agent_id: inbound.agentId,
      exhibitor_id: inbound.exhibitorId,
      created_by_id: currentUser.id,
      stage,
      source_job_id: inbound.id,
      operational: emptyOperationalDetails(stage, inbound.internationalJenis),
    })
  } catch (error) {
    translateConstraint(error)
  }
}

/**
 * Otomatis setelah CIPL job masuk tersimpan: pastikan tiap tahap yang barangnya ada di CIPL punya
 * job. Tidak membuat ulang tahap yang pernah ada (termasuk yang batal); pelanggaran unique
 * `jobs_source_stage_active_key` ditelan karena berarti dibuat orang lain hampir bersamaan.
 */
export async function ensureStageJobs(currentUser: CurrentUser, inbound: Job): Promise<void> {
  const expected = expectedDerivedStages(inbound.ciplLines, inbound.internationalJenis)
  if (!expected.length) return
  const existing = new Set((await listDerivedJobs(inbound.id)).map((job) => job.stage))
  for (const stage of expected) {
    if (existing.has(stage)) continue
    try {
      await insertStageJob(currentUser, inbound, stage)
    } catch (error) {
      if (
        error instanceof JobConstraintError &&
        error.constraint === 'jobs_source_stage_active_key'
      ) {
        continue
      }
      throw error
    }
  }
}

/** Buat job tahap secara manual (override operator), dari job masuk yang belum batal. */
export async function createStageJob(
  currentUser: CurrentUser,
  sourceJobId: string,
  stage: DerivedJobStage,
): Promise<Job> {
  const source = await findJobById(sourceJobId)
  if (!source) throw new ApiError(404, 'Job tidak ditemukan.')
  await authorizeJobWriteInEvent(currentUser, 'job:create', source.eventId)
  assertNotCancelled(source)
  if (source.stage !== 'INBOUND') {
    throw new ApiError(400, 'Job turunan hanya dibuat dari job masuk rangkaian ini.')
  }
  if (!derivedStagesOf(source.internationalJenis).includes(stage)) {
    throw new ApiError(
      400,
      source.internationalJenis === 'ATA_CARNET'
        ? 'ATA Carnet: seluruh barang wajib kembali — tidak ada job disposal.'
        : 'Permanent Import tidak punya job turunan.',
    )
  }
  const existing = await listDerivedJobs(source.id)
  const alreadyExists = existing.some((job) => job.stage === stage && job.status !== 'CANCELLED')
  if (alreadyExists) {
    throw new ApiError(409, `Job ${jobStageLabel(source.internationalJenis, stage)} untuk kiriman ini sudah ada.`)
  }
  try {
    return await insertStageJob(currentUser, source, stage)
  } catch (error) {
    if (
      error instanceof JobConstraintError &&
      error.constraint === 'jobs_source_stage_active_key'
    ) {
      throw new ApiError(409, `Job ${jobStageLabel(source.internationalJenis, stage)} untuk kiriman ini sudah ada.`)
    }
    throw error
  }
}
