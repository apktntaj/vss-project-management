// Perhitungan StatusTuntasEvent (docs/domain/event-data-definitions.md, keputusan 2026-10-29).
// Murni: tanpa I/O, tanpa import lintas lapisan — bentuk job diterima structural typing agar
// kolom tabel `jobs` (sisi server) maupun DTO Job (data-client) sama-sama bisa dipakai.

import type { EventTuntasStatus } from '@/domain/event/types'

/**
 * Bagian job yang diperlukan perhitungan tuntas. Field longgar (string/unknown) karena sumber
 * datanya payload jsonb yang bisa berasal dari beberapa generasi bentuk job.
 */
export type TuntasJobShape = {
  /** Job batal tidak ikut hitungan tuntas (tidak ada lagi pekerjaan yang diharapkan). */
  status?: string | null
  /** Tahap dokumen BC (INBOUND/DISPOSAL/RE_EXPORT); null untuk Local/Road Shipment. */
  stage?: string | null
  kind?: string | null
  internationalJenis?: string | null
  /** Blok kepulangan (JobReturn) — cukup diketahui terisi atau kosong. */
  kepulangan?: unknown
  operational?: {
    customs?: Record<
      string,
      { applicable?: boolean; status?: string; registrationNumber?: string | null } | undefined
    > | null
  } | null
}

// Kepulangan wajib hanya pada job re-ekspor (barang keluar negeri lagi) dan Road Shipment
// (kiriman road kembali tanpa terbelah tahap). Job masuk dan job disposal tidak punya kepulangan;
// job lama tanpa stage mengikuti jenis international-nya.

// Dokumen BC dianggap selesai bila staff menutupnya (status COMPLETED) ATAU bukti registrasi
// DJBC sudah terisi — dua sinyal penutupan yang independen di data live.
function dokumenBcSelesai(dokumen: {
  status?: string
  registrationNumber?: string | null
}): boolean {
  return dokumen.status === 'COMPLETED' || (dokumen.registrationNumber ?? '').trim() !== ''
}

/** Job tuntas ⇔ semua dokumen BC yang applicable selesai ∧ kepulangan tercatat bila wajib. */
export function jobTuntas(job: TuntasJobShape): boolean {
  const customs = job.operational?.customs ?? {}
  const semuaDokumenSelesai = Object.values(customs).every((dokumen) => {
    if (!dokumen || dokumen.applicable === false) return true
    return dokumenBcSelesai(dokumen)
  })
  const wajibKepulangan =
    job.stage === 'RE_EXPORT' ||
    (job.stage == null &&
      job.kind === 'INTERNATIONAL' &&
      job.internationalJenis === 'ROAD_SHIPMENT')
  const kepulanganTercatat = job.kepulangan != null && typeof job.kepulangan === 'object'
  return semuaDokumenSelesai && (!wajibKepulangan || kepulanganTercatat)
}

// Job batal tidak ikut rollup: tidak ada lagi pekerjaan yang diharapkan darinya.
const aktif = (jobs: readonly TuntasJobShape[]) => jobs.filter((job) => job.status !== 'CANCELLED')

/** Rollup event: TANPA_JOB bila tanpa job aktif; BELUM_TUNTAS bila ada yang belum; TUNTAS bila semua. */
export function eventTuntas(jobs: readonly TuntasJobShape[]): EventTuntasStatus {
  const active = aktif(jobs)
  if (active.length === 0) return 'TANPA_JOB'
  return active.every(jobTuntas) ? 'TUNTAS' : 'BELUM_TUNTAS'
}

/** Jumlah job yang belum tuntas — dipakai peringatan arsip ("masih ada N job belum tuntas"). */
export function hitungJobBelumTuntas(jobs: readonly TuntasJobShape[]): number {
  return aktif(jobs).filter((job) => !jobTuntas(job)).length
}
