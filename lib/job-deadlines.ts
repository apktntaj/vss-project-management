// Tenggat pabean job untuk banner di header detail job: tenggat re-ekspor jaminan (Temporary
// Import) dan masa berlaku carnet (ATA). Derivasi murni tanpa I/O (gaya `lib/job-readiness.ts`);
// impor hanya dari domain, jangan dari `@/lib/data-client`.
//
// KEPUTUSAN TERBUKA (bisnis): ambang hari peringatan di bawah ini asumsi UI sementara, belum
// diputuskan. Cukup ubah dua konstanta ini bila bisnis menetapkan angka lain.

import { normalizeOperationalDetails } from '@/domain/job/operational'
import type { Job } from '@/domain/job/types'

/** Sisa hari ≤ ini = peringatan (amber). */
export const DEADLINE_WARNING_DAYS = 14
/** Sisa hari ≤ ini = mendesak (merah). */
export const DEADLINE_CRITICAL_DAYS = 7

export type DeadlineKind = 'REEXPORT' | 'CARNET'
/** ok: masih longgar; warning/critical: mendekati tenggat; expired: sudah lewat. */
export type DeadlineLevel = 'ok' | 'warning' | 'critical' | 'expired'

export type JobDeadline = {
  kind: DeadlineKind
  label: string
  /** Tanggal tenggat apa adanya (YYYY-MM-DD atau ISO). */
  date: string
  /** Sisa hari kalender; negatif = sudah lewat. */
  daysLeft: number
  level: DeadlineLevel
  /** true bila nilainya dibaca dari job masuk (job turunan re-ekspor). */
  fromSource: boolean
}

type DeadlineJob = Pick<Job, 'operational' | 'stage' | 'internationalJenis' | 'status' | 'sourceJobId'>

const DAY_MS = 86_400_000

/** Hari kalender dari `now` (zona lokal) ke tanggal `YYYY-MM-DD…`; null bila bentuknya tak dikenali. */
export function daysUntil(date: string, now: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date.trim())
  if (!match) return null
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / DAY_MS)
}

export function deadlineLevel(daysLeft: number): DeadlineLevel {
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= DEADLINE_CRITICAL_DAYS) return 'critical'
  if (daysLeft <= DEADLINE_WARNING_DAYS) return 'warning'
  return 'ok'
}

function build(
  kind: DeadlineKind,
  label: string,
  date: string | null | undefined,
  fromSource: boolean,
  now: Date,
): JobDeadline[] {
  if (!date) return []
  const daysLeft = daysUntil(date, now)
  if (daysLeft === null) return []
  return [{ kind, label, date, daysLeft, level: deadlineLevel(daysLeft), fromSource }]
}

/**
 * Tenggat yang relevan untuk job ini. Job masuk membaca datanya sendiri; job re-ekspor membaca dari
 * job masuk (`source`) bila sudah dimuat. Disposal tidak punya tenggat (barang tidak kembali).
 * Job batal tidak menampilkan tenggat.
 */
export function jobDeadlines(
  job: DeadlineJob,
  source: DeadlineJob | null | undefined,
  now: Date = new Date(),
): JobDeadline[] {
  if (job.status === 'CANCELLED' || job.stage == null || job.stage === 'DISPOSAL') return []
  const jenis = job.internationalJenis
  if (jenis !== 'TEMPORARY_IMPORT' && jenis !== 'ATA_CARNET') return []
  const fromSource = job.stage === 'RE_EXPORT'
  const holder = fromSource ? source : job
  if (!holder) return []
  const operational = normalizeOperationalDetails(
    holder.operational,
    holder.stage,
    holder.internationalJenis,
  )
  return jenis === 'TEMPORARY_IMPORT'
    ? build('REEXPORT', 'Tenggat re-ekspor', operational.guarantee?.reExportDeadline, fromSource, now)
    : build('CARNET', 'Masa berlaku carnet', operational.carnet?.validUntil, fromSource, now)
}

/** Kalimat hitung mundur: "12 hari lagi", "hari ini", "terlewat 3 hari". */
export function deadlineCountdown(daysLeft: number): string {
  if (daysLeft === 0) return 'hari ini'
  if (daysLeft > 0) return `${daysLeft} hari lagi`
  return `terlewat ${-daysLeft} hari`
}
