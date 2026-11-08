// Stepper "Milestone Job" halaman detail: derivasi murni dari aggregate Job (tanpa I/O, gaya
// `lib/manifest-view.ts`) sehingga bisa dites bun. Impor hanya dari domain — jangan dari
// `@/lib/data-client` (modul itu `'use client'`).

import { normalizeOperationalDetails } from '@/domain/job/operational'
import { deriveCiplStatus, type CiplStatus, type CiplStatusSummary } from '@/domain/job/cipl-status'
import { invoiceStatusLabels, type InvoiceStatus, type Job } from '@/domain/job/types'
import { jobLabel } from '@/domain/job/numbering'

/** Tab area kerja halaman detail job; state aktif disimpan di URL (`?tab=`). */
export type JobDetailTab = 'muatan' | 'transport' | 'billing'

/** Tujuan langkah kesiapan: tab area kerja, atau 'header' = dialog ubah header job (bukan tab). */
export type JobReadinessTarget = JobDetailTab | 'header'

export type JobReadinessStepState = 'todo' | 'doing' | 'done'

export type JobReadinessStep = {
  key: 'number' | 'transport' | 'cipl' | 'customs' | 'invoice'
  label: string
  detail: string
  state: JobReadinessStepState
  tab: JobReadinessTarget
}

export type JobReadiness = { steps: JobReadinessStep[]; doneCount: number }

const ciplStepStates: Record<CiplStatus, JobReadinessStepState> = {
  MISSING: 'todo',
  PARTIAL: 'doing',
  RECEIVED: 'done',
}

function ciplStepDetail(cipl: CiplStatusSummary): string {
  if (cipl.status === 'MISSING') return 'Belum ada'
  if (cipl.status === 'RECEIVED') return 'Diterima'
  return cipl.hasInvoice ? 'PL belum ada' : 'CI belum ada'
}

const invoiceStepStates: Record<InvoiceStatus, JobReadinessStepState> = {
  NOT_READY: 'todo',
  READY: 'doing',
  SENT: 'doing',
  PAID: 'done',
}

function customsStep(job: Job): JobReadinessStep {
  if (job.kind === 'LOCAL')
    return {
      key: 'customs',
      label: 'Dokumen BC',
      detail: 'Tidak diperlukan',
      state: 'done',
      tab: 'transport',
    }
  const documents = Object.values(normalizeOperationalDetails(job.operational).customs)
  const required = documents.filter((document) => document.applicable).length
  const completed = documents.filter(
    (document) => document.applicable && document.status === 'COMPLETED',
  ).length
  const state: JobReadinessStepState =
    required === 0 || completed === required ? 'done' : completed > 0 ? 'doing' : 'todo'
  return {
    key: 'customs',
    label: 'Dokumen BC',
    detail: required === 0 ? 'Tidak diperlukan' : `${completed}/${required} selesai`,
    state,
    tab: 'transport',
  }
}

/** Lima langkah milestone job: nomor, dokumen angkut, CIPL, dokumen BC, tagihan. */
export function buildJobReadiness(job: Job): JobReadiness {
  const cipl = deriveCiplStatus(job)
  const steps: JobReadinessStep[] = [
    {
      key: 'number',
      label: 'No Job',
      detail: jobLabel(job),
      state: job.jobNumber ? 'done' : 'todo',
      tab: 'header',
    },
    {
      key: 'transport',
      label: 'B/L · AWB',
      detail: job.transportDocumentNumber
        ? `${job.transportDocumentType ?? ''} ${job.transportDocumentNumber}`.trim()
        : 'Belum ada',
      state: job.transportDocumentNumber ? 'done' : 'todo',
      tab: 'transport',
    },
    {
      key: 'cipl',
      label: 'CIPL',
      detail: ciplStepDetail(cipl),
      state: ciplStepStates[cipl.status],
      tab: 'muatan',
    },
    customsStep(job),
    {
      key: 'invoice',
      label: 'Tagihan',
      detail: invoiceStatusLabels[job.invoice.status],
      state: invoiceStepStates[job.invoice.status],
      tab: 'billing',
    },
  ]
  return { steps, doneCount: steps.filter((step) => step.state === 'done').length }
}
