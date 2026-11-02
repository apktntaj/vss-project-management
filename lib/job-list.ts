// Logika murni tabel /jobs: filter dan urutan bawaan. Urutan meniru manifest — per event, lalu
// per awalan No Job (S, A, ATA, TI, PI, RS, LOC), lalu per urutan — sehingga tabel datar tetap
// terbaca seperti dokumen klien, sementara pencarian dilakukan lewat filter.

import type { InternationalJobJenis, InvoiceStatus, Job, JobStatus, TransportMode } from '@/domain/job/types'

const PREFIX_ORDER = ['S', 'A', 'ATA', 'TI', 'PI', 'RS', 'LOC']

export type JobListEvent = { id: string; name: string; startsOn: string | null; endsOn: string | null }

export type JobTableFilters = {
  search: string
  eventId: string
  /** 'LOCAL' atau salah satu jenis international; kosong = semua. */
  jenis: '' | 'LOCAL' | InternationalJobJenis
  transportMode: '' | TransportMode
  status: '' | JobStatus
  invoiceStatus: '' | InvoiceStatus
  /** Hanya job pada event yang belum selesai. */
  activeOnly: boolean
}

export const emptyJobTableFilters: JobTableFilters = {
  search: '',
  eventId: '',
  jenis: '',
  transportMode: '',
  status: '',
  invoiceStatus: '',
  activeOnly: true,
}

/** Event dianggap aktif sampai akhir hari tanggal selesainya; event tanpa tanggal tetap aktif. */
export function isEventActive(event: JobListEvent | undefined, today = new Date()): boolean {
  if (!event) return false
  if (!event.endsOn) return true
  return new Date(`${event.endsOn}T23:59:59`) >= today
}

function searchText(job: Job): string {
  return [
    job.jobNumber,
    job.vssNumber,
    job.transportDocumentNumber,
    job.commercialInvoiceNumber,
    job.invoice.number,
    job.party?.name,
    ...job.ciplLines.map((line) => line.exhibitor?.name ?? line.nameOnDocument),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function filterJobs(
  jobs: ReadonlyArray<Job>,
  filters: JobTableFilters,
  eventById: ReadonlyMap<string, JobListEvent>,
  today = new Date(),
): Job[] {
  const search = filters.search.trim().toLowerCase()
  return jobs.filter((job) => {
    const jenis = job.kind === 'LOCAL' ? 'LOCAL' : job.internationalJenis
    return (
      (!search || searchText(job).includes(search)) &&
      (!filters.eventId || job.eventId === filters.eventId) &&
      (!filters.jenis || jenis === filters.jenis) &&
      (!filters.transportMode || job.transportMode === filters.transportMode) &&
      (!filters.status || job.status === filters.status) &&
      (!filters.invoiceStatus || job.invoice.status === filters.invoiceStatus) &&
      (!filters.activeOnly || isEventActive(eventById.get(job.eventId), today))
    )
  })
}

function prefixRank(prefix: string | null): number {
  const index = prefix ? PREFIX_ORDER.indexOf(prefix) : -1
  return index === -1 ? PREFIX_ORDER.length : index
}

/**
 * Urutan bawaan: event terbaru dulu (tanggal mulai), lalu awalan No Job, lalu urutan (job yang
 * belum punya urutan di akhir awalannya), lalu job yang dibuat lebih dulu.
 */
export function sortJobsForTable(
  jobs: ReadonlyArray<Job>,
  eventById: ReadonlyMap<string, JobListEvent>,
): Job[] {
  return [...jobs].sort((left, right) => {
    if (left.eventId !== right.eventId) {
      const leftStart = eventById.get(left.eventId)?.startsOn ?? ''
      const rightStart = eventById.get(right.eventId)?.startsOn ?? ''
      if (leftStart !== rightStart) return rightStart.localeCompare(leftStart)
      const leftName = eventById.get(left.eventId)?.name ?? ''
      const rightName = eventById.get(right.eventId)?.name ?? ''
      return leftName.localeCompare(rightName) || left.eventId.localeCompare(right.eventId)
    }
    const prefix = prefixRank(left.manifestPrefix) - prefixRank(right.manifestPrefix)
    if (prefix) return prefix
    const leftSeq = left.manifestSeq ?? Number.MAX_SAFE_INTEGER
    const rightSeq = right.manifestSeq ?? Number.MAX_SAFE_INTEGER
    if (leftSeq !== rightSeq) return leftSeq - rightSeq
    return left.createdAt.localeCompare(right.createdAt)
  })
}
