// Status CIPL turunan: dihitung dari berkas lampiran + data job saat dibaca, bukan field manual.
// Sebuah peran (commercial invoice / packing list) tercakup bila berkas ATAU datanya ada.

import type { Job } from '@/domain/job/types'

export type CiplStatus = 'MISSING' | 'PARTIAL' | 'RECEIVED'

export type CiplStatusSummary = {
  status: CiplStatus
  hasInvoice: boolean
  hasPackingList: boolean
  /** `receivedAt` lampiran CIPL/CI/PL terbaru; null bila hanya data (tanpa berkas). */
  receivedAt: string | null
}

export const ciplStatusLabels: Record<CiplStatus, string> = {
  MISSING: 'Menunggu CIPL',
  PARTIAL: 'Sebagian',
  RECEIVED: 'Diterima',
}

type CiplStatusInput = Pick<Job, 'ciplSources' | 'ciplDocument' | 'ciplLines' | 'operational'>

export function deriveCiplStatus(job: CiplStatusInput): CiplStatusSummary {
  const sources = job.ciplSources
  const hasInvoice =
    sources.some((source) => source.kind === 'CIPL' || source.kind === 'COMMERCIAL_INVOICE') ||
    job.ciplDocument !== null ||
    Boolean(job.operational.invoice)
  const hasPackingList =
    sources.some((source) => source.kind === 'CIPL' || source.kind === 'PACKING_LIST') ||
    job.ciplLines.length > 0
  const receivedAt = sources.reduce<string | null>(
    (latest, source) => (latest === null || source.receivedAt > latest ? source.receivedAt : latest),
    null,
  )
  const status: CiplStatus = hasInvoice && hasPackingList ? 'RECEIVED' : hasInvoice || hasPackingList ? 'PARTIAL' : 'MISSING'
  return { status, hasInvoice, hasPackingList, receivedAt }
}

/** Label tampilan, mis. "Sebagian · Packing list belum ada". */
export function ciplStatusText(summary: CiplStatusSummary): string {
  if (summary.status !== 'PARTIAL') return ciplStatusLabels[summary.status]
  const missing = summary.hasInvoice ? 'Packing list belum ada' : 'Commercial invoice belum ada'
  return `${ciplStatusLabels.PARTIAL} · ${missing}`
}
