// Logika murni tabel /jobs: filter, urutan bawaan, dan urutan per kolom. Urutan bawaan meniru
// manifest — per event, lalu per awalan No Job (S, A, ATA, T, P, R, L), lalu per urutan — sehingga
// tabel datar tetap terbaca seperti dokumen klien, sementara pencarian dilakukan lewat filter.

import {
  invoiceStatuses,
  jobStatuses,
  transportModeLabels,
  type InternationalJobJenis,
  type InvoiceStatus,
  type Job,
  type JobStatus,
  type TransportMode,
} from '@/domain/job/types'
import { deriveCiplStatus, type CiplStatus } from '@/domain/job/cipl-status'
import { jobContext, jobContextKinds } from '@/lib/job-context'

const PREFIX_ORDER = ['S', 'A', 'ATA', 'T', 'P', 'R', 'L']

export type JobListEvent = {
  id: string
  name: string
  venueName: string | null
  startsOn: string | null
  endsOn: string | null
}

export type JobTableFilters = {
  search: string
  eventId: string
  /** 'LOCAL' atau salah satu jenis international; kosong = semua. */
  jenis: '' | 'LOCAL' | InternationalJobJenis
  transportMode: '' | TransportMode
  status: '' | JobStatus
  invoiceStatus: '' | InvoiceStatus
  /** Id agent pihak job; kosong = semua. */
  agentId: string
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
  agentId: '',
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
      (!filters.agentId || (job.party?.kind === 'AGENT' && job.party.id === filters.agentId)) &&
      (!filters.activeOnly || isEventActive(eventById.get(job.eventId), today))
    )
  })
}

function prefixRank(prefix: string | null): number {
  const index = prefix ? PREFIX_ORDER.indexOf(prefix) : -1
  return index === -1 ? PREFIX_ORDER.length : index
}

export type JobAgentOption = { id: string; name: string }

const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

/** Pilihan filter agent: agent yang menjadi pihak minimal satu job, urut nama. */
export function jobAgentOptions(jobs: ReadonlyArray<Job>): JobAgentOption[] {
  const nameById = new Map<string, string>()
  for (const job of jobs) {
    if (job.party?.kind === 'AGENT') nameById.set(job.party.id, job.party.name)
  }
  return [...nameById]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => collator.compare(left.name, right.name))
}

/** Kolom tabel /jobs yang bisa diurutkan lewat klik header. */
export type JobSortKey =
  | 'jobNumber'
  | 'context'
  | 'agent'
  | 'transportMode'
  | 'cipl'
  | 'transportDocument'
  | 'invoice'
  | 'status'

export type JobTableSort = { key: JobSortKey; direction: 'asc' | 'desc' }

const CIPL_RANK: Record<CiplStatus, number> = { MISSING: 0, PARTIAL: 1, RECEIVED: 2 }

/** Nilai urut per kolom: teks dibandingkan natural, angka = peringkat tahapan, null = kosong. */
const SORT_VALUE: Record<JobSortKey, (job: Job) => string | number | null> = {
  jobNumber: (job) => job.jobNumber?.trim() || null,
  context: (job) => jobContextKinds.indexOf(jobContext(job).kind),
  agent: (job) => (job.party?.kind === 'AGENT' ? job.party.name : null),
  transportMode: (job) => (job.transportMode ? transportModeLabels[job.transportMode] : null),
  cipl: (job) => CIPL_RANK[deriveCiplStatus(job).status],
  transportDocument: (job) => job.transportDocumentNumber?.trim() || null,
  invoice: (job) => invoiceStatuses.indexOf(job.invoice.status),
  status: (job) => jobStatuses.indexOf(job.status),
}

/** Klik header: naik → turun → kembali ke urutan bawaan; kolom lain mulai dari naik. */
export function nextJobSort(current: JobTableSort | null, key: JobSortKey): JobTableSort | null {
  if (current?.key !== key) return { key, direction: 'asc' }
  return current.direction === 'asc' ? { key, direction: 'desc' } : null
}

/**
 * Urutan bawaan: event terbaru dulu (tanggal mulai), lalu awalan No Job, lalu urutan (job yang
 * belum punya urutan di akhir awalannya), lalu job yang dibuat lebih dulu. Dengan `sort`, baris
 * diurutkan per kolom itu; nilai kosong selalu di akhir dan nilai sama mempertahankan urutan bawaan.
 */
export function sortJobsForTable(
  jobs: ReadonlyArray<Job>,
  eventById: ReadonlyMap<string, JobListEvent>,
  sort: JobTableSort | null = null,
): Job[] {
  const ordered = [...jobs].sort((left, right) => {
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
  if (!sort) return ordered

  const valueOf = SORT_VALUE[sort.key]
  const sign = sort.direction === 'asc' ? 1 : -1
  return ordered
    .map((job) => ({ job, value: valueOf(job) }))
    .sort((left, right) => {
      if (left.value === null || right.value === null) {
        return Number(left.value === null) - Number(right.value === null)
      }
      return typeof left.value === 'number' && typeof right.value === 'number'
        ? sign * (left.value - right.value)
        : sign * collator.compare(String(left.value), String(right.value))
    })
    .map((entry) => entry.job)
}
