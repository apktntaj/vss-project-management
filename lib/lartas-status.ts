// Ringkasan status LARTAS untuk tool Cek LARTAS: hanya ketentuan (ada/tidak ada + dokumen), tanpa
// data tarif/pajak. Murni supaya aturan "jangan simpulkan tidak ada dari data publik" teruji.

import type { LartasDetail, LartasResult } from '@/domain/lartas/types'

export const lartasStatusKeys = [
  'ada',
  'tidak-ada',
  'belum-terverifikasi',
  'tidak-ditemukan',
  'kode-tidak-valid',
  'gagal',
] as const
export type LartasStatusKey = (typeof lartasStatusKeys)[number]

export type LartasStatus = {
  key: LartasStatusKey
  label: string
  /** Kelas chip (Tailwind). */
  tone: string
  /** true bila ada ketentuan LARTAS yang perlu ditindaklanjuti. */
  flagged: boolean
}

const TONES = {
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
} as const

function hasRequirement(result: LartasResult): boolean {
  const { lartas } = result
  return (
    lartas.import ||
    lartas.border ||
    lartas.postBorder ||
    lartas.export ||
    lartas.importDetails.length > 0 ||
    lartas.borderDetails.length > 0 ||
    lartas.postBorderDetails.length > 0 ||
    lartas.exportDetails.length > 0
  )
}

export function lartasStatus(result: LartasResult): LartasStatus {
  if (result.lookupStatus === 'invalid') {
    return { key: 'kode-tidak-valid', label: 'Kode tidak valid', tone: TONES.slate, flagged: false }
  }
  if (result.lookupStatus === 'source-error') {
    return { key: 'gagal', label: 'Sumber gagal', tone: TONES.slate, flagged: false }
  }
  if (result.lookupStatus === 'not-found') {
    return { key: 'tidak-ditemukan', label: 'Tidak ditemukan', tone: TONES.slate, flagged: false }
  }

  const required = hasRequirement(result)
  // Data publik hanya memverifikasi tarif; status LARTAS-nya belum pasti, jadi jangan diklaim
  // "tidak ada" — cukup ditandai belum terverifikasi.
  if (result.lartas.verification !== 'verified') {
    return {
      key: 'belum-terverifikasi',
      label: 'Belum terverifikasi',
      tone: TONES.amber,
      flagged: required,
    }
  }
  return required
    ? { key: 'ada', label: 'Ada LARTAS', tone: TONES.rose, flagged: true }
    : { key: 'tidak-ada', label: 'Tidak ada', tone: TONES.emerald, flagged: false }
}

/** Dokumen/izin yang dipersyaratkan, unik menurut kode izin, dan berurutan sesuai sumber. */
export function lartasDocuments(result: LartasResult): LartasDetail[] {
  const seen = new Set<string>()
  const documents: LartasDetail[] = []
  for (const detail of [
    ...result.lartas.importDetails,
    ...result.lartas.borderDetails,
    ...result.lartas.postBorderDetails,
    ...result.lartas.exportDetails,
  ]) {
    const key = detail.kodeIzin ?? detail.namaIzin ?? detail.idDokumen ?? ''
    if (!key || seen.has(key)) continue
    seen.add(key)
    documents.push(detail)
  }
  return documents
}
