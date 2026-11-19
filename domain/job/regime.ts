// Alur pabean per rezim (`internationalJenis`) — dokumen tiap tahap job dan tahap turunan yang
// diperkenankan rezim itu. Murni tanpa I/O. Keputusan bisnis 2026-11-17:
//
// | Rezim             | Masuk            | Disposal            | Re-ekspor | Data khusus            |
// |-------------------|------------------|---------------------|-----------|------------------------|
// | TPPB_BC_23        | BC 2.3           | BC 2.5              | BC 3.0    | venue TPPB             |
// | TEMPORARY_IMPORT  | BC 2.0 (PIB)     | BC 2.0 definitif *) | BC 3.0 *) | jaminan + tenggat      |
// | ATA_CARNET        | Carnet (tanpa BC)| — (dilarang)        | Carnet    | carnet (nomor, dst.)   |
// | PERMANENT_IMPORT  | BC 2.0           | —                   | —         | —                      |
// | ROAD_SHIPMENT     | tanpa tahap/dokumen pabean (berangkat dari gudang VSS ke pameran)  |
//
// *) asumsi operasional menunggu konfirmasi: keluar re-ekspor BC 3.0, barang tidak kembali
// ditutup PIB definitif. Kode ini satu-satunya tempat pemetaan itu — koreksinya cukup di sini.

import type {
  CustomsDocumentKind,
  DerivedJobStage,
  InternationalJobJenis,
  JobStage,
} from '@/domain/job/types'

/** Dokumen kepabeanan milik tahap job menurut rezimnya; null = tahap tanpa dokumen (Local/Road). */
export function stageCustomsDocument(
  jenis: InternationalJobJenis | null | undefined,
  stage: JobStage,
): CustomsDocumentKind | null {
  if (jenis == null) {
    // Data tanpa jenis (tidak mungkin baru; constraint DB) — perlakukan seperti TPPB.
    return stage === 'INBOUND' ? 'BC_2_3' : stage === 'DISPOSAL' ? 'BC_2_5' : 'BC_3_0'
  }
  switch (jenis) {
    case 'TPPB_BC_23':
      return stage === 'INBOUND' ? 'BC_2_3' : stage === 'DISPOSAL' ? 'BC_2_5' : 'BC_3_0'
    case 'TEMPORARY_IMPORT':
      return stage === 'RE_EXPORT' ? 'BC_3_0' : 'BC_2_0'
    case 'ATA_CARNET':
      return stage === 'DISPOSAL' ? null : 'CARNET'
    case 'PERMANENT_IMPORT':
      return stage === 'INBOUND' ? 'BC_2_0' : null
    case 'ROAD_SHIPMENT':
      return null
  }
}

/** Tahap turunan yang diperkenankan rezim: ATA tanpa disposal (semua barang wajib kembali),
 * Permanent Import tanpa turunan (barang tetap di Indonesia). */
export function derivedStagesOf(
  jenis: InternationalJobJenis | null | undefined,
): readonly DerivedJobStage[] {
  if (jenis === 'ATA_CARNET') return ['RE_EXPORT']
  if (jenis === 'PERMANENT_IMPORT') return []
  return ['DISPOSAL', 'RE_EXPORT']
}

const fallbackStageLabels: Record<JobStage, string> = {
  INBOUND: 'Masuk',
  DISPOSAL: 'Disposal',
  RE_EXPORT: 'Re-ekspor',
}

/** Label singkat tahap sesuai dokumennya: 'BC 2.3', 'BC 2.0 (definitif)', 'Carnet re-ekspor', … */
export function jobStageLabel(jenis: InternationalJobJenis | null | undefined, stage: JobStage) {
  const document = stageCustomsDocument(jenis, stage)
  if (document == null) return fallbackStageLabels[stage]
  if (document === 'CARNET') return stage === 'RE_EXPORT' ? 'Carnet re-ekspor' : 'Carnet'
  if (jenis === 'TEMPORARY_IMPORT' && stage === 'DISPOSAL') return 'BC 2.0 (definitif)'
  if (jenis === 'TEMPORARY_IMPORT' && stage === 'INBOUND') return 'BC 2.0'
  return (
    {
      BC_2_0: 'BC 2.0',
      BC_2_3: 'BC 2.3',
      BC_2_5: 'BC 2.5',
      BC_3_0: 'BC 3.0',
      BC_2_7: 'BC 2.7',
      CARNET: 'Carnet',
    } as const
  )[document]
}
