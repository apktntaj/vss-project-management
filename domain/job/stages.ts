// Turunan tahap job dari disposisi barang CIPL, mengikuti rezim (`derivedStagesOf`). Murni tanpa
// I/O: dipakai use-case saat menyimpan CIPL job masuk (sumber kebenaran pembuatan job turunan) dan
// UI saat menampilkan barang job turunan. Invarian: tiap koli masuk milik tepat satu tahap.

import { reconcileKoliTotal } from '@/domain/exhibition/cipl-autofill'
import type { DisposisiBarang } from '@/domain/exhibition/cipl-document'
import { koliTersendiri, type DisposisiKoli, type Koli, type KoliCollection } from '@/domain/job/manifest'
import { derivedStagesOf } from '@/domain/job/regime'
import type {
  DerivedJobStage,
  InternationalJobJenis,
  Job,
  JobCiplLine,
  JobKind,
  JobStage,
} from '@/domain/job/types'

/** Tahap job baru: international non-road selalu dimulai sebagai job masuk (BC 2.3). */
export function stageForNewJob(
  kind: JobKind,
  jenis: InternationalJobJenis | null,
): JobStage | null {
  return kind === 'INTERNATIONAL' && jenis !== 'ROAD_SHIPMENT' ? 'INBOUND' : null
}

/** Disposisi barang → tahap job turunan pemilik barangnya. */
export const stageOfDisposisi: Record<DisposisiBarang, DerivedJobStage> = {
  RE_EXPORT: 'RE_EXPORT',
  TIDAK_DISEBUT: 'RE_EXPORT',
  DISPOSED: 'DISPOSAL',
  GIVE_AWAY: 'DISPOSAL',
}

/** Tahap turunan yang harus ada dari baris CIPL menurut rezim, urut tetap; [] bila belum ada
 * item/keputusan koli sama sekali atau rezim tanpa turunan (Permanent Import). */
export function expectedDerivedStages(
  lines: ReadonlyArray<Pick<JobCiplLine, 'items' | 'koli'>>,
  jenis: InternationalJobJenis | null | undefined,
): DerivedJobStage[] {
  const allowed = derivedStagesOf(jenis)
  const stages = new Set<DerivedJobStage>()
  for (const line of lines) {
    for (const item of line.items) stages.add(stageOfDisposisi[item.disposisi])
    // Keputusan manual koli menuntut job turunannya walau barangnya belum dirinci.
    for (const koli of line.koli.details) if (koli.disposisi) stages.add(koli.disposisi)
  }
  return allowed.filter((stage) => stages.has(stage))
}

/**
 * Keputusan disposisi satu koli untuk operator/UI. Keputusan manual yang tersimpan di
 * `koli.disposisi` menang. Tanpa keputusan, disposisi diturunkan dari barang yang menaut koli;
 * koli yang dirujuk barang disposal DAN re-ekspor sekaligus tidak bisa diturunkan →
 * PERLU_DIPUTUSKAN (sampai diputuskan, pembagian job membiarkannya di re-ekspor). Koli tanpa
 * barang tertaut mengikuti aturan barisnya: baris tanpa barang/campur = re-ekspor, baris yang
 * seluruh barangnya disposal = disposal.
 */
export type KeputusanDisposisiKoli =
  | { keputusan: 'MANUAL'; disposisi: DisposisiKoli }
  | { keputusan: 'TURUNAN'; disposisi: DisposisiKoli; dari: 'ISI_KOLI' | 'BARIS' }
  | { keputusan: 'PERLU_DIPUTUSKAN' }

export function keputusanDisposisiKoli(
  line: Pick<JobCiplLine, 'items'>,
  koli: Pick<Koli, 'id' | 'disposisi'>,
): KeputusanDisposisiKoli {
  if (koli.disposisi) return { keputusan: 'MANUAL', disposisi: koli.disposisi }

  let adaDisposal = false
  let adaReExport = false
  if (koli.id) {
    for (const item of line.items) {
      if (!item.refKoliIds.includes(koli.id)) continue
      if (stageOfDisposisi[item.disposisi] === 'DISPOSAL') adaDisposal = true
      else adaReExport = true
    }
  }
  if (adaDisposal && adaReExport) return { keputusan: 'PERLU_DIPUTUSKAN' }
  if (adaDisposal) return { keputusan: 'TURUNAN', disposisi: 'DISPOSAL', dari: 'ISI_KOLI' }
  if (adaReExport) return { keputusan: 'TURUNAN', disposisi: 'RE_EXPORT', dari: 'ISI_KOLI' }

  const semuaDisposal =
    line.items.length > 0 &&
    line.items.every((item) => stageOfDisposisi[item.disposisi] === 'DISPOSAL')
  return {
    keputusan: 'TURUNAN',
    disposisi: semuaDisposal ? 'DISPOSAL' : 'RE_EXPORT',
    dari: 'BARIS',
  }
}

// Koli yang dikosongkan hanya milik barang disposal: dirujuk ≥1 item DISPOSAL dan 0 item RE_EXPORT.
function disposalOnlyKoliIds(line: JobCiplLine): Set<string> {
  const byDisposal = new Set<string>()
  const byReExport = new Set<string>()
  for (const item of line.items) {
    const target = stageOfDisposisi[item.disposisi] === 'DISPOSAL' ? byDisposal : byReExport
    for (const id of item.refKoliIds) target.add(id)
  }
  const ids = new Set<string>()
  for (const id of byDisposal) if (!byReExport.has(id)) ids.add(id)
  return ids
}

/**
 * Baris CIPL sebuah tahap turunan. Aturan per baris masuk:
 * - Keputusan disposisi tersimpan pada koli (`koli.disposisi`) BERWENANG: koli pindah ke tahap
 *   pilihannya apa pun isi barangnya; barang sendiri tetap mengikuti disposisinya masing-masing.
 * - Baris tanpa item: milik RE_EXPORT utuh (disposisi belum disebut = ikut kembali), kecuali koli
 *   yang diputuskan manual DISPOSAL.
 * - Baris yang semua itemnya disposal: seluruh koli milik DISPOSAL, kecuali koli manual RE_EXPORT.
 * - Baris campuran: koli yang hanya dirujuk item disposal ATAU diputuskan manual DISPOSAL pindah ke
 *   DISPOSAL (jumlah = aturan label yang sama dengan total koli); sisanya milik RE_EXPORT dan total
 *   dokumen dibuang agar dijumlah ulang dari rincian.
 */
export function stageCiplLines(
  lines: ReadonlyArray<JobCiplLine>,
  stage: DerivedJobStage,
): JobCiplLine[] {
  const staged: JobCiplLine[] = []
  const kosong = (line: JobCiplLine) =>
    line.koli.totalCount === 0 && line.koli.details.length === 0 && line.items.length === 0
  for (const line of lines) {
    const items = line.items.filter((item) => stageOfDisposisi[item.disposisi] === stage)
    const diputuskan = (disposisi: DisposisiKoli) =>
      line.koli.details.filter((koli) => koli.disposisi === disposisi)

    // Tanpa item sama sekali: barang belum dibedakan — utuh di RE_EXPORT, kecuali koli yang sudah
    // diputuskan manual DISPOSAL.
    if (line.items.length === 0) {
      const manualDisposal = diputuskan('DISPOSAL')
      if (manualDisposal.length === 0) {
        if (stage === 'RE_EXPORT') staged.push(line)
        continue
      }
      const rest = line.koli.details.filter((koli) => koli.disposisi !== 'DISPOSAL')
      const disposalCount = reconcileKoliTotal(manualDisposal, null)
      const next: JobCiplLine =
        stage === 'DISPOSAL'
          ? {
              ...line,
              koli: { totalCount: disposalCount, bareCaseCount: null, details: manualDisposal },
              items: [],
            }
          : {
              ...line,
              koli: {
                // Lantai jumlah baris rincian tersisa: invarian koliCollectionSchema.
                totalCount: Math.max(
                  line.koli.totalCount - disposalCount,
                  koliTersendiri(rest).length,
                ),
                bareCaseCount: line.koli.bareCaseCount,
                details: rest,
              },
              items: [],
            }
      if (!kosong(next)) staged.push(next)
      continue
    }

    const hasReExportItem = line.items.some(
      (item) => stageOfDisposisi[item.disposisi] === 'RE_EXPORT',
    )
    if (!hasReExportItem) {
      // Semua item disposal: seluruh koli (termasuk yang tak terinci) pindah ke DISPOSAL —
      // kecuali koli yang diputuskan manual RE_EXPORT.
      const manualReExport = diputuskan('RE_EXPORT')
      if (manualReExport.length === 0) {
        if (stage === 'DISPOSAL') staged.push(line)
        continue
      }
      const rest = line.koli.details.filter((koli) => koli.disposisi !== 'RE_EXPORT')
      const reExportCount = reconcileKoliTotal(manualReExport, null)
      const next: JobCiplLine =
        stage === 'DISPOSAL'
          ? {
              ...line,
              koli: {
                totalCount: Math.max(
                  line.koli.totalCount - reExportCount,
                  koliTersendiri(rest).length,
                ),
                bareCaseCount: line.koli.bareCaseCount,
                details: rest,
              },
              items,
            }
          : {
              ...line,
              koli: { totalCount: reExportCount, bareCaseCount: null, details: manualReExport },
              items: [],
            }
      if (!kosong(next)) staged.push(next)
      continue
    }

    // Package disposal = keputusan manual DISPOSAL, atau package yang SELURUH isinya disposal;
    // package campur tetap ikut re-ekspor (barang disposal dikeluarkan dulu) kecuali diputuskan
    // manual. Jumlahnya memakai aturan label yang sama dengan total koli ("7-11" = 5 paket),
    // bukan jumlah baris rincian.
    const disposalOnlyIds = disposalOnlyKoliIds(line)
    const disposalDetails = line.koli.details.filter(
      (koli) =>
        koli.disposisi === 'DISPOSAL' ||
        (koli.disposisi == null && koli.id != null && disposalOnlyIds.has(koli.id)),
    )
    const disposalCount = reconcileKoliTotal(disposalDetails, null)
    if (stage === 'DISPOSAL') {
      if (items.length === 0 && disposalDetails.length === 0) continue
      const koli: KoliCollection = {
        totalCount: disposalCount,
        bareCaseCount: null,
        details: disposalDetails,
      }
      staged.push({ ...line, koli, items })
    } else {
      const remaining =
        disposalDetails.length > 0
          ? line.koli.details.filter((koli) => !disposalDetails.includes(koli))
          : line.koli.details
      const koli: KoliCollection =
        disposalDetails.length > 0
          ? {
              // Lantai jumlah baris rincian tersisa: invarian koliCollectionSchema.
              totalCount: Math.max(
                line.koli.totalCount - disposalCount,
                koliTersendiri(remaining).length,
              ),
              bareCaseCount: line.koli.bareCaseCount,
              details: remaining,
            }
          : line.koli
      staged.push({ ...line, koli, items })
    }
  }
  return staged
}

/**
 * Tampilan job lengkap dengan barangnya: job turunan selalu menurunkan `ciplLines` dari job
 * masuknya (tidak pernah disalin saat dibuat); selain itu job dikembalikan apa adanya.
 */
export function withStageGoods(job: Job, source: Job | null | undefined): Job {
  if (
    job.sourceJobId != null &&
    (job.stage === 'DISPOSAL' || job.stage === 'RE_EXPORT') &&
    source != null
  ) {
    return { ...job, ciplLines: stageCiplLines(source.ciplLines, job.stage) }
  }
  return job
}

export type StageWarning = { stage: DerivedJobStage; kind: 'MISSING' | 'UNEXPECTED' }

/** Selisih baris CIPL vs job turunan aktif menurut rezim: tahap yang semestinya ada tapi tidak
 * (MISSING) dan sebaliknya (UNEXPECTED). Tanpa item sama sekali → tidak ada yang bisa diselisihkan. */
export function stageReconciliation(
  lines: ReadonlyArray<Pick<JobCiplLine, 'items' | 'koli'>>,
  activeStages: ReadonlyArray<DerivedJobStage>,
  jenis: InternationalJobJenis | null | undefined,
): StageWarning[] {
  const expected = expectedDerivedStages(lines, jenis)
  if (expected.length === 0 && lines.every((line) => line.items.length === 0)) return []
  const active = new Set(activeStages)
  const warnings: StageWarning[] = []
  for (const stage of expected) {
    if (!active.has(stage)) warnings.push({ stage, kind: 'MISSING' })
  }
  for (const stage of active) {
    if (!expected.includes(stage)) warnings.push({ stage, kind: 'UNEXPECTED' })
  }
  return warnings
}
