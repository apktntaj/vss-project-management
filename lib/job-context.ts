import type { Job } from '@/domain/job/types'

/**
 * Konteks komersial yang menaungi sebuah job. Saat ini hanya EVENT (pameran); General Cargo dan
 * Project menyusul sebagai varian baru. Halaman detail job bercabang di sini, bukan pada
 * `job.eventId`, supaya bagian khas event tidak bocor ke inti job.
 */
export type JobContext = { kind: 'EVENT'; eventId: string }

export function jobContext(job: Pick<Job, 'eventId'>): JobContext {
  return { kind: 'EVENT', eventId: job.eventId }
}
