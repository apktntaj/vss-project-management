import 'server-only'

import { authorizeJobWrite } from '@/features/jobs/use-cases/job-guards'
import { deleteJobRow, findJobById } from '@/features/jobs/repository'
import { removeAttachmentsOfOwner } from '@/lib/supabase/attachments'
import { ApiError } from '@/lib/server/errors'
import type { CurrentUser } from '@/domain/auth/types'

/**
 * Hapus permanen aggregate Job: lampirannya (berkas + metadata), tiket berkonteks job ini, lalu
 * barisnya. Lampiran dihapus lebih dulu agar kegagalan storage tidak meninggalkan berkas yatim
 * tanpa pemilik.
 */
export async function deleteJob(currentUser: CurrentUser, jobId: string): Promise<void> {
  await authorizeJobWrite(currentUser, 'job:delete', jobId)
  const job = await findJobById(jobId)
  if (!job) throw new ApiError(404, 'Job tidak ditemukan.')
  await removeAttachmentsOfOwner('JOB', job.id)
  await deleteJobRow(job.id)
}
