// Apakah sebuah tab detail job (Muatan / Transport / Billing) sudah punya data yang diisi.
// Tab tanpa data menampilkan "Belum ada data" dan tombol "Buat …"; tab berisi menampilkan kartu dan
// tombol "Edit …". Keduanya memakai `hasTabData` yang sama. Logika murni.

import { deriveCiplStatus } from '@/domain/job/cipl-status'
import { emptyOperationalDetails, normalizeOperationalDetails } from '@/domain/job/operational'
import type { Job, JobCustomsDocument, JobTransportLeg } from '@/domain/job/types'

export type DetailTab = 'muatan' | 'transport' | 'billing'

const legHasData = (leg: JobTransportLeg) =>
  Boolean(leg.mode || leg.carrier || leg.scheduleAt || leg.actualAt)

const customsHasData = (document: JobCustomsDocument, defaults: JobCustomsDocument) =>
  document.applicable !== defaults.applicable ||
  document.status !== defaults.status ||
  Boolean(
    document.ajuNumber ||
      document.registrationNumber ||
      document.registrationDate ||
      document.warehouseName,
  )

const hasTabDataBy: Record<DetailTab, (job: Job) => boolean> = {
  // CIPL/CI/PL (berkas atau data), atau manifest inward/kepulangan.
  muatan: (job) =>
    deriveCiplStatus(job).status !== 'MISSING' || job.inward !== null || job.kepulangan !== null,
  // Dokumen angkut, leg perjalanan, logistik, atau dokumen BC yang sudah diubah dari default.
  transport: (job) => {
    const operational = normalizeOperationalDetails(job.operational)
    const defaults = emptyOperationalDetails().customs
    return (
      job.transportDocument !== null ||
      Boolean(job.transportDocumentType || job.transportDocumentNumber) ||
      legHasData(operational.inbound) ||
      legHasData(operational.outbound) ||
      Boolean(job.emptyStorage || job.reExport) ||
      (Object.keys(defaults) as (keyof typeof defaults)[]).some((kind) =>
        customsHasData(operational.customs[kind], defaults[kind]),
      )
    )
  },
  // Pihak yang ditagih atau tagihan yang sudah diisi.
  billing: (job) => {
    const { invoice } = job
    return (
      job.party !== null ||
      Boolean(invoice.number || invoice.sentAt || invoice.paidAt) ||
      invoice.amount !== null ||
      invoice.status !== 'NOT_READY'
    )
  },
}

export function hasTabData(tab: DetailTab, job: Job): boolean {
  return hasTabDataBy[tab](job)
}

const tabNouns: Record<DetailTab, string> = {
  muatan: 'CIPL',
  transport: 'Transport',
  billing: 'Billing',
}

/** Label tombol di ujung tab: "Buat CIPL" bila belum ada data, selebihnya "Edit CIPL". */
export function tabActionLabel(tab: DetailTab, job: Job): string {
  return `${hasTabData(tab, job) ? 'Edit' : 'Buat'} ${tabNouns[tab]}`
}
