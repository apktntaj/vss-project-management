// Turunan tahap job dari disposisi barang CIPL, mengikuti rezim (`derivedStagesOf`). Murni tanpa
// I/O: dipakai use-case saat menyimpan CIPL job masuk (sumber kebenaran pembuatan job turunan) dan
// UI saat menampilkan barang job turunan. Invarian: tiap koli masuk milik tepat satu tahap.

import type { DisposisiBarang } from '@/domain/exhibition/cipl-document'
import { koliTersendiri, type KoliCollection } from '@/domain/job/manifest'
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
 * item sama sekali atau rezim tanpa turunan (Permanent Import). */
export function expectedDerivedStages(
  lines: ReadonlyArray<Pick<JobCiplLine, 'items'>>,
  jenis: InternationalJobJenis | null | undefined,
): DerivedJobStage[] {
  const allowed = derivedStagesOf(jenis)
  const stages = new Set<DerivedJobStage>()
  for (const line of lines) {
    for (const item of line.items) stages.add(stageOfDisposisi[item.disposisi])
  }
  return allowed.filter((stage) => stages.has(stage))
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
 * - Baris tanpa item: milik RE_EXPORT utuh (disposisi belum disebut = ikut kembali); DISPOSAL tidak.
 * - Baris yang semua itemnya disposal: seluruh koli milik DISPOSAL; RE_EXPORT tidak mendapat apa pun.
 * - Baris campuran: koli yang hanya dirujuk item disposal pindah ke DISPOSAL (jumlah = koli berdiri
 *   sendiri); sisanya milik RE_EXPORT dan total dokumen dibuang agar dijumlah ulang dari rincian.
 */
export function stageCiplLines(
  lines: ReadonlyArray<JobCiplLine>,
  stage: DerivedJobStage,
): JobCiplLine[] {
  const staged: JobCiplLine[] = []
  for (const line of lines) {
    const items = line.items.filter((item) => stageOfDisposisi[item.disposisi] === stage)

    // Tanpa item sama sekali: barang belum dibedakan — utuh di RE_EXPORT, bukan disposal pasti.
    if (line.items.length === 0) {
      if (stage === 'RE_EXPORT') staged.push(line)
      continue
    }

    const hasReExportItem = line.items.some(
      (item) => stageOfDisposisi[item.disposisi] === 'RE_EXPORT',
    )
    if (!hasReExportItem) {
      // Semua item disposal: seluruh koli (termasuk yang tak terinci) pindah ke DISPOSAL.
      if (stage === 'DISPOSAL') staged.push(line)
      continue
    }

    const disposalOnlyIds = disposalOnlyKoliIds(line)
    const disposalOnly = line.koli.details.filter(
      (koli) => koli.id != null && disposalOnlyIds.has(koli.id),
    )
    if (stage === 'DISPOSAL') {
      if (items.length === 0) continue
      const koli: KoliCollection = {
        totalCount: koliTersendiri(disposalOnly).length,
        bareCaseCount: null,
        details: disposalOnly,
      }
      staged.push({ ...line, koli, items })
    } else {
      const koli: KoliCollection =
        disposalOnly.length > 0
          ? {
              totalCount: line.koli.totalCount - koliTersendiri(disposalOnly).length,
              bareCaseCount: line.koli.bareCaseCount,
              details: line.koli.details.filter(
                (koli) => koli.id == null || !disposalOnlyIds.has(koli.id),
              ),
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
  lines: ReadonlyArray<Pick<JobCiplLine, 'items'>>,
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
