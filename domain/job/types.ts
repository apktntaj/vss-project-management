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

/** Dokumen BC yang dilayani job; BC 2.7 dipakai untuk pengalihan barang (inward manifest ALLPACK). */
export const bcDocumentKinds = ['BC_2_3', 'BC_2_5', 'BC_3_0', 'BC_2_7'] as const
export type BcDocumentKind = (typeof bcDocumentKinds)[number]

export const bcDocumentLabels: Record<BcDocumentKind, string> = {
  BC_2_3: 'BC 2.3',
  BC_2_5: 'BC 2.5',
  BC_3_0: 'BC 3.0',
  BC_2_7: 'BC 2.7',
}

// ---------------------------------------------------------------------------------------------
// Bagian dalam aggregate Job. Dibaca-tulis bersama job dan dijaga `domain/job/validation.ts`.
// Model 2026-11-02: job = satu kiriman = satu B/L/AWB = satu tagihan ke satu pihak.
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

export type JobCiplInfo = {
  status: 'MISSING' | 'REQUESTED' | 'RECEIVED' | 'VERIFIED'
  referenceNumber: string | null
  receivedAt: string | null
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

/** Status dokumen BC. Penagihan TIDAK di sini: satu job = satu tagihan (`Job.invoice`). */
export type JobCustomsDocument = {
  applicable: boolean
  status: (typeof jobCustomsStatuses)[number]
  ajuNumber: string | null
  registrationNumber: string | null
  registrationDate: string | null
  warehouseName: string | null
}

export type JobOperationalDetails = {
  inbound: JobTransportLeg
  outbound: JobTransportLeg
  /** Nomor + baris commercial invoice hasil ekstraksi (bagian CI dari CIPL). */
  invoiceNumber?: string | null
  invoiceItems?: JobInvoiceItem[]
  /** Hasil ekstraksi commercial invoice lengkap; sumber BC 2.3 dan pembanding B/L. */
  invoice?: JobInvoiceExtraction | null
  cipl: JobCiplInfo
  customs: Record<BcDocumentKind, JobCustomsDocument>
}

export const jobDocumentKinds = [
  'SOURCE',
  'INBOUND_TRANSPORT',
  'OUTBOUND_TRANSPORT',
  'BILL_OF_LADING',
  'AIR_WAYBILL',
  'COMMERCIAL_INVOICE',
  'CIPL',
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

export type JobUserRef = { id: string; name: string }

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
> & { partyName: string | null }
