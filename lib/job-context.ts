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

/** Varian konteks yang direncanakan; `JobContext` baru memodelkan EVENT, sisanya menyusul. */
export const jobContextKinds = ['EVENT', 'GENERAL_CARGO', 'PROJECT'] as const
export type JobContextKind = (typeof jobContextKinds)[number]

/** Label kolom "Jenis job". */
export const jobContextLabels: Record<JobContextKind, string> = {
  EVENT: 'Event',
  GENERAL_CARGO: 'Genco',
  PROJECT: 'Project',
}
