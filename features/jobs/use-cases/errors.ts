import 'server-only'

// Penerjemah error constraint Postgres → ApiError berpesan Indonesia, dan helper tulis aggregate
// yang terjaga versi. Dipakai bersama oleh use-case tulis job.

import { ApiError } from '@/lib/server/errors'
import {
  JobConstraintError,
  findJobById,
  updateJobGuarded,
  type JobWritableColumns,
} from '@/features/jobs/repository'
import type { Job } from '@/domain/job/types'

const JOB_CANCELLED_MESSAGE = 'Job sudah dibatalkan dan tidak dapat diubah lagi.'

const CONSTRAINT_MESSAGES: Record<string, [number, string]> = {
  jobs_event_id_fkey: [400, 'Event tidak ditemukan.'],
  jobs_agent_fk: [400, 'Agent tidak ditemukan.'],
  jobs_exhibitor_fk: [400, 'Exhibitor tidak terdaftar di event job ini.'],
  jobs_jenis_matches_kind: [400, 'Jenis job tidak sesuai dengan jalur Local/International.'],
  jobs_single_party: [400, 'Pihak job hanya satu: agent atau exhibitor.'],
  jobs_exhibitor_only_party: [400, 'Job Local selalu dipegang exhibitor, bukan agent.'],
  jobs_road_mode: [400, 'Road Shipment hanya lewat jalur darat.'],
  jobs_manifest_number_key: [409, 'No Job dengan urutan itu sudah dipakai di event ini.'],
  jobs_manifest_seq_needs_prefix: [400, 'Isi jalur (laut/udara/darat) dulu sebelum menetapkan No Job.'],
  jobs_invoice_sent_has_number: [400, 'Nomor tagihan wajib diisi sebelum tagihan dikirim.'],
  jobs_invoice_paid_has_date: [400, 'Tanggal lunas wajib diisi.'],
  job_cipl_lines_exhibitor_key: [400, 'Satu exhibitor hanya boleh muncul sekali dalam satu job.'],
  job_cipl_lines_exhibitor_event: [400, 'Exhibitor pada baris CIPL harus terdaftar di event job ini.'],
  job_cancelled: [409, JOB_CANCELLED_MESSAGE],
}

/** Ubah pelanggaran constraint yang dikenal menjadi ApiError; error lain diteruskan apa adanya. */
export function translateConstraint(error: unknown): never {
  if (error instanceof JobConstraintError && error.constraint) {
    const mapped = CONSTRAINT_MESSAGES[error.constraint]
    if (mapped) throw new ApiError(mapped[0], mapped[1])
  }
  throw error
}

export const STALE_VERSION_MESSAGE =
  'Job telah diubah pengguna lain. Muat ulang halaman lalu ulangi perubahan Anda.'

/**
 * Tulis kolom aggregate dengan guard versi. Bila tak ada baris yang cocok, bedakan job hilang
 * (404) dari versi basi (409) agar klien tahu harus memuat ulang.
 */
export async function writeJob(
  jobId: string,
  expectedVersion: number,
  columns: JobWritableColumns,
): Promise<Job> {
  let updated: Job | null
  try {
    updated = await updateJobGuarded(jobId, expectedVersion, columns)
  } catch (error) {
    translateConstraint(error)
  }
  if (updated) return updated
  const current = await findJobById(jobId)
  if (!current) throw new ApiError(404, 'Job tidak ditemukan.')
  assertNotCancelled(current)
  throw new ApiError(409, STALE_VERSION_MESSAGE)
}

/** Job batal tidak menerima perubahan apa pun; 409 agar klien tahu itu keadaan, bukan salah input. */
export function assertNotCancelled(job: Pick<Job, 'status'>): void {
  if (job.status === 'CANCELLED') throw new ApiError(409, JOB_CANCELLED_MESSAGE)
}

/** Muat job untuk perintah yang perlu membaca isinya dulu; 404 / 409 sama seperti `writeJob`. */
export async function loadJobForWrite(jobId: string, expectedVersion: number): Promise<Job> {
  const job = await findJobById(jobId)
  if (!job) throw new ApiError(404, 'Job tidak ditemukan.')
  assertNotCancelled(job)
  if (job.version !== expectedVersion) throw new ApiError(409, STALE_VERSION_MESSAGE)
  return job
}
