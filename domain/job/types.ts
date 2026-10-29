/** Jenis track job: Local tanpa dokumen kepabeanan, International jalur customs. */
export type JobKind = 'LOCAL' | 'INTERNATIONAL'

/**
 * Sub-jenis job international pada event — rezim kepabeanan pengiriman barang.
 * Daftar ini eksklusif: tidak ada jenis lain di luar lima nilai berikut.
 */
export type InternationalJobJenis =
  | 'TPPB_BC_23'
  | 'ATA_CARNET'
  | 'TEMPORARY_IMPORT'
  | 'PERMANENT_IMPORT'
  | 'ROAD_SHIPMENT'

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
