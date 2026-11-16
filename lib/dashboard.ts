// Dashboard operasional: empat daftar kesiapan kedatangan barang (event belum ada job, ETA dekat
// dokumen kurang, ETA belum diisi) + bobot event + special instruction per event. Dihitung MURNI dari satu bacaan data (aggregate
// `jobs` + jadwal event ACTIVE; pola `lib/job-readiness.ts`/`lib/job-list.ts`: derivasi murni,
// tanpa I/O). Orkestrasi pembacaan data ada di `features/dashboard/use-cases/get-dashboard.ts`.

import type { EventScheduleRef } from '@/domain/event/types'
import { ciplStatusText, deriveCiplStatus } from '@/domain/job/cipl-status'
import { findMilestone, summarizeKoliCollections } from '@/domain/job/manifest'
import { jobLabel } from '@/domain/job/numbering'
import type { Job } from '@/domain/job/types'

export const ETA_HORIZON_DAYS = 7
// Ketentuan shipping manual klien: barang harus TIBA 14 hari sebelum tanggal mulai pameran.
export const ARRIVAL_LEAD_DAYS = 14
// Jendela perencanaan: event yang mulai dalam 30 hari.
export const ARRIVAL_PLAN_HORIZON_DAYS = 30

/** Event yang segera mulai tetapi belum punya satu pun job. */
export type EventWithoutJobRow = {
  eventId: string
  eventName: string
  venueName: string
  startsOn: string
  arrivalDeadline: string // startsOn − ARRIVAL_LEAD_DAYS
  daysToDeadline: number // daysBetween(today, arrivalDeadline); negatif = sudah lewat
}

/** Job ber-ETA dekat (atau lewat) yang CIPL atau nomor B/L·AWB-nya belum lengkap. */
export type JobDocsRow = {
  jobId: string
  jobTitle: string
  eventId: string
  eventName: string
  eta: string
  missing: string[] // urut: teks CIPL lalu nomor dokumen angkut
}

/** Job aktif tanpa tanggal ETA. */
export type JobEtaMissingRow = {
  jobId: string
  jobTitle: string
  eventId: string
  eventName: string
  eventStartsOn: string | null
  arrivalDeadline: string | null // null bila event tanpa tanggal mulai
}

/** Bobot event = jumlah job + total koli. */
export type EventWeightRow = {
  eventId: string
  eventName: string
  venueName: string
  startsOn: string
  jobCount: number
  koliCount: number
  score: number // jobCount + koliCount
}

/** Special instruction job aktif pada satu event (peringatan permintaan khusus klien). */
export type EventSpecialInstructionsRow = {
  eventId: string
  eventName: string
  venueName: string
  startsOn: string | null
  jobs: Array<{ jobId: string; jobTitle: string; text: string }>
}

export type OperationsDashboard = {
  eventsWithoutJob: EventWithoutJobRow[]
  etaDocsMissing: JobDocsRow[]
  etaMissing: JobEtaMissingRow[]
  eventWeights: EventWeightRow[]
  specialInstructions: EventSpecialInstructionsRow[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Urutan teks natural (angka dibaca sebagai angka) — sama dengan `lib/job-list.ts`.
const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

// Tanggal ISO + N hari (aritmetika UTC pada tanggal-saja, tanpa objek Date zona-lokal).
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Selisih hari from → to (positif bila `to` setelah `from`).
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

// ETA job punya dua tempat isi: form header job (`operational.inbound.scheduleAt`) menang; bila
// kosong/berbentuk lain, milestone manifest `ETA` dijadikan cadangan.
function jobEta(job: Job): string | null {
  const scheduleAt = job.operational.inbound.scheduleAt?.slice(0, 10) ?? ''
  if (ISO_DATE.test(scheduleAt)) return scheduleAt
  return findMilestone(job.inward?.milestones ?? [], 'ETA')?.date ?? null
}

function jobTitle(job: Job): string {
  return `${jobLabel(job)} · ${job.party?.name || 'Pihak belum ditetapkan'}`
}

// Kekurangan dokumen kedatangan: CIPL (turunan lampiran + data), lalu nomor dokumen angkut untuk
// moda SEA/AIR. Moda ROAD/null dan job Local tidak mewajibkan nomor itu.
function missingArrivalDocs(job: Job): string[] {
  const missing: string[] = []
  const cipl = deriveCiplStatus(job)
  if (cipl.status !== 'RECEIVED') missing.push(ciplStatusText(cipl))
  if (
    (job.transportMode === 'SEA' || job.transportMode === 'AIR') &&
    job.kind !== 'LOCAL' &&
    !(job.transportDocumentNumber ?? '').trim()
  ) {
    missing.push(job.transportMode === 'AIR' ? 'AWB belum ada' : 'B/L belum ada')
  }
  return missing
}

/**
 * Seluruh dashboard operasional. Cakupan = job pada event ACTIVE yang tidak dibatalkan
 * (`events` hanya berisi event ACTIVE; pemanggil menjamin itu). Semua tanggal dibandingkan
 * sebagai string YYYY-MM-DD terhadap `today` (WIB).
 */
export function buildOperationsDashboard(input: {
  jobs: readonly Job[]
  events: readonly EventScheduleRef[]
  today: string
}): OperationsDashboard {
  const { jobs, events, today } = input
  const eventById = new Map(events.map((event) => [event.id, event]))
  const collate = collator.compare

  // Job tercakup = pada event ACTIVE dan tidak dibatalkan; job aktif = yang belum selesai.
  const covered = jobs.filter((job) => eventById.has(job.eventId) && job.status !== 'CANCELLED')
  const active = covered.filter((job) => job.status !== 'COMPLETED')
  const jobsOf = (eventId: string) => covered.filter((job) => job.eventId === eventId)

  const eventNotEnded = (event: EventScheduleRef) => event.endsOn === null || event.endsOn >= today
  const planHorizon = addDays(today, ARRIVAL_PLAN_HORIZON_DAYS)

  // 1. Event yang segera mulai tanpa satu pun job (job selesai tetap dihitung "sudah ada job").
  const eventsWithoutJob: EventWithoutJobRow[] = []
  for (const event of events) {
    const { startsOn } = event
    if (startsOn === null || startsOn <= today || startsOn > planHorizon) continue
    if (jobsOf(event.id).length > 0) continue
    const arrivalDeadline = addDays(startsOn, -ARRIVAL_LEAD_DAYS)
    eventsWithoutJob.push({
      eventId: event.id,
      eventName: event.name,
      venueName: event.venueName,
      startsOn,
      arrivalDeadline,
      daysToDeadline: daysBetween(today, arrivalDeadline),
    })
  }
  eventsWithoutJob.sort(
    (a, b) => a.startsOn.localeCompare(b.startsOn) || collate(a.eventName, b.eventName),
  )

  // 2 & 3. Job aktif pada pameran yang belum selesai: ETA dekat/lewat dengan dokumen kurang, dan
  // ETA yang belum diisi.
  const etaHorizon = addDays(today, ETA_HORIZON_DAYS)
  const etaDocsMissing: JobDocsRow[] = []
  const etaMissing: JobEtaMissingRow[] = []
  for (const job of active) {
    // Kedatangan hanya urusan job masuk (BC 2.3); job turunan tidak punya ETA/dokumen sendiri.
    if (job.sourceJobId) continue
    const event = eventById.get(job.eventId)
    if (!event || !eventNotEnded(event)) continue
    const eta = jobEta(job)
    if (eta === null) {
      etaMissing.push({
        jobId: job.id,
        jobTitle: jobTitle(job),
        eventId: event.id,
        eventName: event.name,
        eventStartsOn: event.startsOn,
        arrivalDeadline: event.startsOn === null ? null : addDays(event.startsOn, -ARRIVAL_LEAD_DAYS),
      })
      continue
    }
    if (eta > etaHorizon) continue
    const missing = missingArrivalDocs(job)
    if (missing.length === 0) continue
    etaDocsMissing.push({
      jobId: job.id,
      jobTitle: jobTitle(job),
      eventId: event.id,
      eventName: event.name,
      eta,
      missing,
    })
  }
  etaDocsMissing.sort((a, b) => a.eta.localeCompare(b.eta) || collate(a.jobTitle, b.jobTitle))
  etaMissing.sort((a, b) => {
    if (a.eventStartsOn !== b.eventStartsOn) {
      if (a.eventStartsOn === null) return 1
      if (b.eventStartsOn === null) return -1
      return a.eventStartsOn.localeCompare(b.eventStartsOn)
    }
    return collate(a.jobTitle, b.jobTitle)
  })

  // 4. Bobot event = jumlah job + total koli, untuk pameran belum selesai yang mulai dalam jendela
  // (pameran yang sedang berlangsung ikut). Event tanpa job tetap tampil dengan skor 0.
  const eventWeights: EventWeightRow[] = []
  for (const event of events) {
    const { startsOn } = event
    if (startsOn === null || !eventNotEnded(event) || startsOn > planHorizon) continue
    const eventJobs = jobsOf(event.id)
    const koliCount = summarizeKoliCollections(
      eventJobs.flatMap((job) => job.ciplLines.map((line) => line.koli)),
    ).totalCount
    eventWeights.push({
      eventId: event.id,
      eventName: event.name,
      venueName: event.venueName,
      startsOn,
      jobCount: eventJobs.length,
      koliCount,
      score: eventJobs.length + koliCount,
    })
  }
  eventWeights.sort(
    (a, b) =>
      b.score - a.score ||
      a.startsOn.localeCompare(b.startsOn) ||
      collate(a.eventName, b.eventName),
  )

  // 5. Special instruction (permintaan khusus klien) job aktif, dikelompokkan per event. Tidak
  // dibatasi tanggal pameran: instruksi seperti "urgent re-export" justru relevan setelah selesai.
  const instructionGroups = new Map<string, EventSpecialInstructionsRow>()
  for (const job of active) {
    const text = job.specialInstructions?.trim()
    const event = eventById.get(job.eventId)
    if (!text || !event) continue
    const group = instructionGroups.get(event.id) ?? {
      eventId: event.id,
      eventName: event.name,
      venueName: event.venueName,
      startsOn: event.startsOn,
      jobs: [],
    }
    group.jobs.push({ jobId: job.id, jobTitle: jobTitle(job), text })
    instructionGroups.set(event.id, group)
  }
  const specialInstructions = [...instructionGroups.values()]
  for (const group of specialInstructions) group.jobs.sort((a, b) => collate(a.jobTitle, b.jobTitle))
  specialInstructions.sort((a, b) => {
    if (a.startsOn !== b.startsOn) {
      if (a.startsOn === null) return 1
      if (b.startsOn === null) return -1
      return a.startsOn.localeCompare(b.startsOn)
    }
    return collate(a.eventName, b.eventName)
  })

  return { eventsWithoutJob, etaDocsMissing, etaMissing, eventWeights, specialInstructions }
}
