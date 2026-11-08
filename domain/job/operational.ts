// Logika murni bagian `operational` aggregate Job: default awal, pelengkapan bentuk yang belum
// utuh, dan penerapan hasil ekstraksi dokumen (commercial invoice / B/L / AWB). Tanpa I/O —
// dipakai server saat menulis (sumber kebenaran) dan klien saat menampilkan.

import type {
  JobInvoiceExtraction,
  JobTransportExtraction,
} from '@/domain/exhibition/source-documents'
import type {
  BcDocumentKind,
  JobCustomsDocument,
  JobOperationalDetails,
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

/** Default customs per BC: 2.3 dan 3.0 diperlukan, 2.5 dan 2.7 tidak. */
const DEFAULT_APPLICABLE: Record<BcDocumentKind, boolean> = {
  BC_2_3: true,
  BC_2_5: false,
  BC_3_0: true,
  BC_2_7: false,
}

/** Bagian operational untuk job yang baru dibuat. */
export function emptyOperationalDetails(): JobOperationalDetails {
  return {
    inbound: emptyLeg(),
    outbound: emptyLeg(),
    invoiceNumber: null,
    customs: {
      BC_2_3: emptyCustomsDocument(DEFAULT_APPLICABLE.BC_2_3),
      BC_2_5: emptyCustomsDocument(DEFAULT_APPLICABLE.BC_2_5),
      BC_3_0: emptyCustomsDocument(DEFAULT_APPLICABLE.BC_3_0),
      BC_2_7: emptyCustomsDocument(DEFAULT_APPLICABLE.BC_2_7),
    },
  }
}

/**
 * Lengkapi bentuk operational yang belum utuh (mis. customs tanpa BC_2_7) dengan default, tanpa
 * menimpa nilai yang sudah ada. `null`/`undefined` menghasilkan operational kosong.
 */
export function normalizeOperationalDetails(
  stored: Partial<JobOperationalDetails> | null | undefined,
): JobOperationalDetails {
  const base = emptyOperationalDetails()
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
