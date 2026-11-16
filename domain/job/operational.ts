// Logika murni bagian `operational` aggregate Job: default awal, pelengkapan bentuk yang belum
// utuh, dan penerapan hasil ekstraksi dokumen (commercial invoice / B/L / AWB). Tanpa I/O —
// dipakai server saat menulis (sumber kebenaran) dan klien saat menampilkan.

import type {
  JobInvoiceExtraction,
  JobTransportExtraction,
} from '@/domain/exhibition/source-documents'
import { jobStageBcDocument } from '@/domain/job/types'
import type {
  BcDocumentKind,
  JobCustomsDocument,
  JobOperationalDetails,
  JobStage,
  JobTransportLeg,
  TransportDocumentType,
} from '@/domain/job/types'

function emptyLeg(): JobTransportLeg {
  return { mode: null, carrier: null, scheduleAt: null, actualAt: null }
}

export function emptyCustomsDocument(applicable = true): JobCustomsDocument {
  return {
    applicable,
    status: 'NOT_STARTED',
    ajuNumber: null,
    registrationNumber: null,
    registrationDate: null,
    warehouseName: null,
  }
}

/**
 * Bagian operational untuk job yang baru dibuat: hanya dokumen BC milik tahap job yang
 * applicable (job masuk = BC 2.3, turunan = BC 2.5/BC 3.0); tanpa tahap (Local/Road) tidak ada.
 */
export function emptyOperationalDetails(stage: JobStage | null): JobOperationalDetails {
  return {
    inbound: emptyLeg(),
    outbound: emptyLeg(),
    invoiceNumber: null,
    customs: {
      BC_2_3: emptyCustomsDocument(stage != null && jobStageBcDocument[stage] === 'BC_2_3'),
      BC_2_5: emptyCustomsDocument(stage != null && jobStageBcDocument[stage] === 'BC_2_5'),
      BC_3_0: emptyCustomsDocument(stage != null && jobStageBcDocument[stage] === 'BC_3_0'),
      BC_2_7: emptyCustomsDocument(false),
    },
  }
}

/**
 * Lengkapi bentuk operational yang belum utuh (mis. customs tanpa BC_2_7) dengan default, tanpa
 * menimpa nilai yang sudah ada. `null`/`undefined` menghasilkan operational kosong. Default
 * `applicable` mengikuti tahap job (tanpa tahap = tidak ada dokumen BC applicable).
 */
export function normalizeOperationalDetails(
  stored: Partial<JobOperationalDetails> | null | undefined,
  stage: JobStage | null = null,
): JobOperationalDetails {
  const base = emptyOperationalDetails(stage)
  if (!stored) return base
  const customs = (stored.customs ?? {}) as Partial<Record<BcDocumentKind, JobCustomsDocument>>
  return {
    ...base,
    ...stored,
    inbound: { ...base.inbound, ...stored.inbound },
    outbound: { ...base.outbound, ...stored.outbound },
    customs: {
      BC_2_3: customs.BC_2_3 ?? base.customs.BC_2_3,
      BC_2_5: customs.BC_2_5 ?? base.customs.BC_2_5,
      BC_3_0: customs.BC_3_0 ?? base.customs.BC_3_0,
      BC_2_7: customs.BC_2_7 ?? base.customs.BC_2_7,
    },
  }
}

export type DocumentExtraction = {
  /** Commercial invoice (bagian CI dari CIPL). */
  invoice?: JobInvoiceExtraction | null
  /** B/L atau AWB. */
  transport?: JobTransportExtraction | null
  /**
   * Jenis dokumen angkut bila diketahui (dari klasifikasi upload). Bila absen, dipakai jenis yang
   * sudah tercatat di job, lalu BL sebagai default.
   */
  transportDocumentType?: TransportDocumentType | null
}

/** Field job (di luar `operational`) yang berubah karena ekstraksi. */
export type ExtractedJobFields = {
  transportDocument?: JobTransportExtraction
  transportDocumentType?: TransportDocumentType
  transportDocumentNumber?: string | null
  /** Diisi hanya bila job belum punya nomor commercial invoice. */
  commercialInvoiceNumber?: string
}

/**
 * Terapkan hasil ekstraksi dokumen ke job. Commercial invoice mengisi nomor + baris barang
 * (operational) dan — bila job belum punya — akhiran No Job. B/L/AWB menjadi dokumen angkut job
 * (jenis + nomor + isi mentah) serta mengisi carrier leg inbound. ETA/jadwal tetap milik job.
 */
export function applyDocumentExtraction(
  current: {
    operational: JobOperationalDetails
    transportDocumentType: TransportDocumentType | null
    commercialInvoiceNumber: string | null
  },
  extraction: DocumentExtraction,
): { operational: JobOperationalDetails; fields: ExtractedJobFields } {
  let operational = normalizeOperationalDetails(current.operational)
  const fields: ExtractedJobFields = {}

  if (extraction.invoice) {
    const invoice = extraction.invoice
    operational = {
      ...operational,
      invoiceNumber: invoice.invoiceNumber ?? operational.invoiceNumber ?? null,
      invoiceItems: invoice.items,
      invoice,
    }
    const number = invoice.invoiceNumber?.trim()
    if (number && !current.commercialInvoiceNumber) fields.commercialInvoiceNumber = number
  }

  if (extraction.transport) {
    const transport = extraction.transport
    const documentType = extraction.transportDocumentType ?? current.transportDocumentType ?? 'BL'
    operational = {
      ...operational,
      inbound: {
        ...operational.inbound,
        mode: documentType === 'BL' ? 'SEA' : 'AIR',
        carrier: transport.carrier,
        // scheduleAt sengaja tidak disentuh: jadwal kedatangan milik job, bukan hasil baca B/L.
      },
    }
    fields.transportDocument = transport
    fields.transportDocumentType = documentType
    fields.transportDocumentNumber = transport.documentNumber?.trim() || null
  }

  return { operational, fields }
}
