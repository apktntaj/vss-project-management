import type {
  JobInvoiceExtraction,
  JobInvoiceItem,
  JobTransportExtraction,
} from '@/domain/exhibition/source-documents'
import type { BarisBarang, CiplDocument } from '@/domain/exhibition/cipl-document'
import type {
  InwardManifest,
  JobReturn,
  KoliCollection,
  OperationalNote,
} from '@/domain/job/manifest'

/** Jenis track job: Local tanpa dokumen kepabeanan, International jalur customs. */
export const jobKinds = ['LOCAL', 'INTERNATIONAL'] as const
export type JobKind = (typeof jobKinds)[number]

/**
 * Sub-jenis job international pada event — rezim kepabeanan pengiriman barang.
 * Daftar ini eksklusif: tidak ada jenis lain di luar lima nilai berikut.
 */
export const internationalJobJenisValues = [
  'TPPB_BC_23',
  'ATA_CARNET',
  'TEMPORARY_IMPORT',
  'PERMANENT_IMPORT',
  'ROAD_SHIPMENT',
] as const
export type InternationalJobJenis = (typeof internationalJobJenisValues)[number]

export const jobStatuses = ['DRAFT', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const
export type JobStatus = (typeof jobStatuses)[number]
export const jobStatusLabels: Record<JobStatus, string> = {
  DRAFT: 'Draf',
  IN_PROGRESS: 'Sedang diproses',
  ON_HOLD: 'Ditunda',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
}

export const jobKindLabels: Record<JobKind, string> = {
  LOCAL: 'Local',
  INTERNATIONAL: 'International',
}

export const internationalJobJenisLabels: Record<InternationalJobJenis, string> = {
  TPPB_BC_23: 'TPPB (BC 2.3)',
  ATA_CARNET: 'ATA Carnet',
  TEMPORARY_IMPORT: 'Temporary Import',
  PERMANENT_IMPORT: 'Permanent Import (Genco)',
  ROAD_SHIPMENT: 'Road Shipment',
}

/**
 * Dokumen BC yang dikenal sistem. BC 2.0 = PIB (impor biasa/impor sementara non-TPPB);
 * BC 2.7 = pengalihan barang antar-TPB (inward manifest ALLPACK), bukan tahap job.
 */
export const bcDocumentKinds = ['BC_2_0', 'BC_2_3', 'BC_2_5', 'BC_3_0', 'BC_2_7'] as const
export type BcDocumentKind = (typeof bcDocumentKinds)[number]

export const bcDocumentLabels: Record<BcDocumentKind, string> = {
  BC_2_0: 'BC 2.0',
  BC_2_3: 'BC 2.3',
  BC_2_5: 'BC 2.5',
  BC_3_0: 'BC 3.0',
  BC_2_7: 'BC 2.7',
}

/**
 * Seluruh dokumen kepabeanan yang dilayani sebuah tahap job: dokumen BC ditambah Carnet untuk
 * job ATA (bukan dokumen BC — pencatatannya tetap bentuk yang sama: status + nomor + tanggal).
 */
export const customsDocumentKinds = [...bcDocumentKinds, 'CARNET'] as const
export type CustomsDocumentKind = (typeof customsDocumentKinds)[number]

export const customsDocumentLabels: Record<CustomsDocumentKind, string> = {
  ...bcDocumentLabels,
  CARNET: 'Carnet',
}

// Tahap job dalam rangkaian pabean: kiriman international non-road terbelah menjadi satu job
// masuk (INBOUND) plus job turunan per dokumen keluar — DISPOSAL (barang tidak kembali) dan
// RE_EXPORT (barang kembali). Dokumen tiap tahap mengikuti rezim (`domain/job/regime.ts`):
// TPPB = BC 2.3/2.5/3.0, Temporary Import = BC 2.0/BC 2.0 definitif/BC 3.0, ATA Carnet =
// Carnet tanpa disposal, Permanent Import = BC 2.0 tanpa turunan. Road Shipment dan Local
// tidak punya tahap.
export const jobStages = ['INBOUND', 'DISPOSAL', 'RE_EXPORT'] as const
export type JobStage = (typeof jobStages)[number]
export const derivedJobStages = ['DISPOSAL', 'RE_EXPORT'] as const
export type DerivedJobStage = (typeof derivedJobStages)[number]
export const isDerivedJobStage = (stage: JobStage | null | undefined): stage is DerivedJobStage =>
  (derivedJobStages as readonly (JobStage | null | undefined)[]).includes(stage)

// ---------------------------------------------------------------------------------------------
// Bagian dalam aggregate Job. Dibaca-tulis bersama job dan dijaga `domain/job/validation.ts`.
// Model 2026-11-02 (revisi 2026-11-16): kiriman = rangkaian 1 job masuk (BC 2.3) + 0..2 job
// turunan (BC 2.5 / BC 3.0) dari disposisi barang CIPL; tiap job tetap satu tagihan sendiri.
// ---------------------------------------------------------------------------------------------

export const transportModes = ['SEA', 'AIR', 'ROAD'] as const
export type TransportMode = (typeof transportModes)[number]
export const transportModeLabels: Record<TransportMode, string> = {
  SEA: 'Laut',
  AIR: 'Udara',
  ROAD: 'Darat',
}

export const transportDocumentTypes = ['BL', 'AWB'] as const
export type TransportDocumentType = (typeof transportDocumentTypes)[number]

/** Leg perjalanan. Nomor dokumen angkut milik job (`transportDocumentNumber`), bukan leg. */
export type JobTransportLeg = {
  mode: 'SEA' | 'AIR' | 'LOCAL' | null
  carrier: string | null
  scheduleAt: string | null
  actualAt: string | null
}

export const jobCustomsStatuses = [
  'NOT_STARTED',
  'PREPARING',
  'SUBMITTED',
  'REGISTERED',
  'RELEASED',
  'COMPLETED',
  'ON_HOLD',
] as const

export const jobCustomsStatusLabels: Record<(typeof jobCustomsStatuses)[number], string> = {
  NOT_STARTED: 'Belum mulai',
  PREPARING: 'Disiapkan',
  SUBMITTED: 'Diajukan',
  REGISTERED: 'Terdaftar',
  RELEASED: 'Keluar (SPPB)',
  COMPLETED: 'Selesai',
  ON_HOLD: 'Ditahan',
}

/** Status dokumen kepabeanan (BC atau Carnet). Penagihan TIDAK di sini: satu job = satu tagihan. */
export type JobCustomsDocument = {
  applicable: boolean
  status: (typeof jobCustomsStatuses)[number]
  ajuNumber: string | null
  registrationNumber: string | null
  registrationDate: string | null
  warehouseName: string | null
}

/** Jenis jaminan impor sementara (Temporary Import non-TPPB). */
export const guaranteeKinds = ['CASH', 'BANK_GUARANTEE', 'CUSTOMS_BOND', 'CORPORATE_GUARANTEE'] as const
export type GuaranteeKind = (typeof guaranteeKinds)[number]

export const guaranteeKindLabels: Record<GuaranteeKind, string> = {
  CASH: 'Uang jaminan (cash)',
  BANK_GUARANTEE: 'Bank guarantee',
  CUSTOMS_BOND: 'Customs bond',
  CORPORATE_GUARANTEE: 'Jaminan perusahaan',
}

/**
 * Identitas carnet job ATA: diisi pada job masuk, diturunkan tampilannya ke job re-ekspor.
 * Penjamin default KADIN Indonesia (penjamin carnet nasional) — boleh dikosongkan/ditulis lain.
 */
export type JobCarnet = {
  number: string | null
  issuingCountry: string | null
  guarantor: string | null
  validUntil: string | null
}

/** Jaminan PIB impor sementara (Temporary Import): jenis, nomor, nilai, tenggat re-ekspor. */
export type JobGuarantee = {
  kind: GuaranteeKind | null
  number: string | null
  amount: number | null
  currency: string | null
  reExportDeadline: string | null
}

export type JobOperationalDetails = {
  inbound: JobTransportLeg
  outbound: JobTransportLeg
  /** Nomor + baris commercial invoice hasil ekstraksi (bagian CI dari CIPL). */
  invoiceNumber?: string | null
  invoiceItems?: JobInvoiceItem[]
  /** Hasil ekstraksi commercial invoice lengkap; sumber dokumen masuk dan pembanding B/L. */
  invoice?: JobInvoiceExtraction | null
  customs: Record<CustomsDocumentKind, JobCustomsDocument>
  /** Identitas carnet — hanya bermakna untuk job ATA Carnet; null pada rezim lain. */
  carnet: JobCarnet | null
  /** Jaminan impor sementara — hanya bermakna untuk job Temporary Import; null pada rezim lain. */
  guarantee: JobGuarantee | null
}

export const jobDocumentKinds = [
  'SOURCE',
  'INBOUND_TRANSPORT',
  'OUTBOUND_TRANSPORT',
  'BILL_OF_LADING',
  'AIR_WAYBILL',
  'COMMERCIAL_INVOICE',
  'CIPL',
  'PACKING_LIST',
  'BC_2_0',
  'BC_2_3',
  'BC_2_5',
  'BC_3_0',
  'BC_2_7',
  'OTHER',
] as const
export type JobDocumentKind = (typeof jobDocumentKinds)[number]

export const jobDocumentKindLabels: Record<JobDocumentKind, string> = {
  SOURCE: 'Dokumen sumber',
  INBOUND_TRANSPORT: 'Angkut masuk',
  OUTBOUND_TRANSPORT: 'Angkut keluar',
  BILL_OF_LADING: 'Bill of Lading',
  AIR_WAYBILL: 'Air Waybill',
  COMMERCIAL_INVOICE: 'Commercial invoice',
  CIPL: 'CIPL',
  PACKING_LIST: 'Packing list',
  BC_2_0: 'BC 2.0',
  BC_2_3: 'BC 2.3',
  BC_2_5: 'BC 2.5',
  BC_3_0: 'BC 3.0',
  BC_2_7: 'BC 2.7',
  OTHER: 'Lainnya',
}

// --- Tagihan ---------------------------------------------------------------------------------

export const invoiceStatuses = ['NOT_READY', 'READY', 'SENT', 'PAID'] as const
export type InvoiceStatus = (typeof invoiceStatuses)[number]
export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  NOT_READY: 'Belum siap',
  READY: 'Siap ditagih',
  SENT: 'Terkirim',
  PAID: 'Lunas',
}

/** Tagihan job ke pihaknya (agent / exhibitor). Satu job = satu tagihan. */
export type JobInvoice = {
  number: string | null
  amount: number | null
  currency: string | null
  status: InvoiceStatus
  sentAt: string | null
  paidAt: string | null
}

// --- Pihak & baris CIPL ------------------------------------------------------------------------

/** Pihak yang ditagih: agent atau exhibitor. Nama hasil join baca-saja. */
export type JobParty =
  | { kind: 'AGENT'; id: string; name: string }
  | { kind: 'EXHIBITOR'; id: string; name: string }

/** Barang satu exhibitor di job ini (satu entri CIPL yang sudah ditinjau). */
export type JobCiplLine = {
  id: string
  /** Null sampai ditautkan ke exhibitor event. */
  exhibitorId: string | null
  /** Hasil join baca-saja. */
  exhibitor: { id: string; name: string; hall: string | null; booth: string | null } | null
  nameOnDocument: string
  koli: KoliCollection
  items: BarisBarang[]
  notes: OperationalNote[]
}

/** Masukan simpan baris CIPL (tanpa id/join). */
export type JobCiplLineInput = Pick<JobCiplLine, 'exhibitorId' | 'nameOnDocument' | 'koli' | 'items' | 'notes'>

export const jobCiplSourceKinds = ['CIPL', 'COMMERCIAL_INVOICE', 'PACKING_LIST'] as const
export type JobCiplSourceKind = (typeof jobCiplSourceKinds)[number]

/** Satu berkas lampiran job yang menjadi sumber CIPL; `receivedAt` = waktu unggah. */
export type JobCiplSource = { kind: JobCiplSourceKind; receivedAt: string }

export type JobUserRef = { id: string; name: string }

/** Fakta pembatalan job (tabel `job_cancellations`); job batal tidak dapat diubah lagi. */
export type JobCancellation = { reason: string; cancelledAt: string; cancelledById: string }

// --- Aggregate root ----------------------------------------------------------------------------

export type Job = {
  id: string
  /** Versi optimistic-concurrency; wajib dikirim balik pada setiap tulis. */
  version: number
  eventId: string
  kind: JobKind
  internationalJenis: InternationalJobJenis | null
  transportMode: TransportMode | null
  status: JobStatus
  /** Terisi tepat bila `status === 'CANCELLED'`. */
  cancellation: JobCancellation | null
  /** Tahap dokumen BC; null untuk Local dan Road Shipment. DISPOSAL/RE_EXPORT = job turunan. */
  stage: JobStage | null
  /** Job masuk (BC 2.3) tempat job turunan diturunkan; terisi tepat bila stage DISPOSAL/RE_EXPORT. */
  sourceJobId: string | null

  agentId: string | null
  exhibitorId: string | null
  /** Pihak yang ditagih; null bila belum ditetapkan. */
  party: JobParty | null

  /** Awalan No Job dari jalur + jenis (S, A, ATA, T, P, R, L); null bila jalur belum diisi. */
  manifestPrefix: string | null
  /** Urutan No Job per event per awalan, ditetapkan operator. */
  manifestSeq: number | null
  /** Akhiran No Job: nomor commercial invoice pengirim. */
  commercialInvoiceNumber: string | null
  /** No Job tampilan, mis. `S.01/234YFN`; null bila urutan belum ditetapkan. */
  jobNumber: string | null

  transportDocumentType: TransportDocumentType | null
  transportDocumentNumber: string | null
  /** Dokumen angkut mentah hasil ekstraksi/koreksi (pihak, pelabuhan, kontainer, ...). */
  transportDocument: JobTransportExtraction | null
  /** CIPL mentah hasil scan (header + entri). */
  ciplDocument: CiplDocument | null
  ciplLines: JobCiplLine[]
  /** Lampiran job berjenis CIPL/CI/PL (baca-saja, dimuat repository); sumber status CIPL turunan. */
  ciplSources: JobCiplSource[]

  invoice: JobInvoice

  assignedToId: string | null
  createdById: string | null
  assignedTo: JobUserRef | null

  operational: JobOperationalDetails
  inward: InwardManifest | null
  kepulangan: JobReturn | null
  emptyStorage: string | null
  reExport: string | null
  notes: string | null
  /** Permintaan khusus klien (mis. "butuh vacuum pack", "urgent re-export"): peringatan di dashboard & manifest. */
  specialInstructions: string | null
  createdAt: string
  updatedAt: string
}

/** Bentuk ringkas untuk dropdown/label (tiket, dashboard). */
export type JobSummary = Pick<
  Job,
  | 'id'
  | 'manifestPrefix'
  | 'eventId'
  | 'jobNumber'
  | 'status'
  | 'kind'
  | 'internationalJenis'
  | 'assignedToId'
  | 'stage'
  | 'sourceJobId'
> & { partyName: string | null }
