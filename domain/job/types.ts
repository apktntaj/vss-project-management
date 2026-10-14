/** Jenis track job: Local tanpa dokumen kepabeanan, International jalur customs. */
export type JobKind = 'LOCAL' | 'INTERNATIONAL'

/**
 * Sub-jenis job international — mengikuti grup pengiriman pada inward manifest.
 * Daftar ini eksklusif: tidak ada jenis lain di luar lima nilai berikut.
 */
export type InternationalJobJenis =
  | 'VENUE'
  | 'ROAD_SHIPMENT'
  | 'PERMANENT_IMPORT'
  | 'ATA_CARNET'
  | 'TEMPORARY_EXPORT'

export const jobKindLabels: Record<JobKind, string> = {
  LOCAL: 'Local',
  INTERNATIONAL: 'International',
}

export const internationalJobJenisLabels: Record<InternationalJobJenis, string> = {
  VENUE: 'Venue',
  ROAD_SHIPMENT: 'Road Shipment',
  PERMANENT_IMPORT: 'Permanent Import',
  ATA_CARNET: 'ATA Carnet',
  TEMPORARY_EXPORT: 'Ekspor Sementara',
}
