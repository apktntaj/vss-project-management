// Perhitungan StatusTuntasEvent (docs/domain/event-data-definitions.md, keputusan 2026-10-29).
// Murni: tanpa I/O, tanpa import lintas lapisan — bentuk job diterima structural typing agar
// payload jsonb `jobs` (sisi server) maupun LocalJob (data-client) sama-sama bisa dipakai.

import type { EventTuntasStatus } from '@/domain/event/types'

/**
 * Bagian job yang diperlukan perhitungan tuntas. Field longgar (string/unknown) karena sumber
 * datanya payload jsonb yang bisa berasal dari beberapa generasi bentuk job.
 */
export type TuntasJobShape = {
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

// Jenis international yang mewajibkan barang kembali ( Permanent Import tidak; Local tidak;
// job lama tanpa kind tidak — kepulangan bukan bagian model lamanya).
const JENIS_WAJIB_KEPULANGAN = new Set([
  'TPPB_BC_23',
  'ATA_CARNET',
  'TEMPORARY_IMPORT',
  'ROAD_SHIPMENT',
])

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
    job.kind === 'INTERNATIONAL' && JENIS_WAJIB_KEPULANGAN.has(job.internationalJenis ?? '')
  const kepulanganTercatat = job.kepulangan != null && typeof job.kepulangan === 'object'
  return semuaDokumenSelesai && (!wajibKepulangan || kepulanganTercatat)
}

/** Rollup event: TANPA_JOB bila tanpa job; BELUM_TUNTAS bila ada yang belum; TUNTAS bila semua. */
export function eventTuntas(jobs: readonly TuntasJobShape[]): EventTuntasStatus {
  if (jobs.length === 0) return 'TANPA_JOB'
  return jobs.every(jobTuntas) ? 'TUNTAS' : 'BELUM_TUNTAS'
}

/** Jumlah job yang belum tuntas — dipakai peringatan arsip ("masih ada N job belum tuntas"). */
export function hitungJobBelumTuntas(jobs: readonly TuntasJobShape[]): number {
  return jobs.filter((job) => !jobTuntas(job)).length
}
