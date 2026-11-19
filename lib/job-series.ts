// Logika murni kartu "Rangkaian job": keadaan pemuatan rangkaian dan tampilan satu tahap turunan.
// Memuat dan gagal dibedakan dari "memang belum ada" agar kartu tidak menawarkan tombol Buat job
// untuk tahap yang mungkin sudah ada.

import type { Job, JobSummary } from '@/domain/job/types'

/** Keadaan pemuatan rangkaian: belum selesai, gagal, atau termuat (rootId = job masuk rangkaian). */
export type JobSeriesState =
  | { readonly kind: 'LOADING' }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'LOADED'; readonly rootId: string; readonly summaries: readonly JobSummary[] }

/** Keadaan sesudah pemuatan baru dimulai: data lama rangkaian yang sama dipertahankan. */
export function seriesStateOnReload(previous: JobSeriesState, rootId: string): JobSeriesState {
  return previous.kind === 'LOADED' && previous.rootId === rootId ? previous : { kind: 'LOADING' }
}

export type StageSlot =
  | { readonly kind: 'LOADING' }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'FOUND'; readonly job: Job | JobSummary }
  | { readonly kind: 'EMPTY' }

/** Tampilan satu tahap turunan: memuat, gagal, ada (dengan ringkasannya), atau memang belum ada. */
export function stageSlot(state: JobSeriesState, stage: string): StageSlot {
  switch (state.kind) {
    case 'LOADING':
      return { kind: 'LOADING' }
    case 'FAILED':
      return { kind: 'FAILED' }
    case 'LOADED': {
      const summary = state.summaries.find((item) => item.stage === stage)
      return summary ? { kind: 'FOUND', job: summary } : { kind: 'EMPTY' }
    }
    default: {
      const unreachable: never = state
      return unreachable
    }
  }
}

/** Tampilan tahap job masuk dari halaman turunan: job masuk bila ada, selain itu ikut keadaan pemuatan. */
export function inboundSlot(sourceJob: Job | null, state: JobSeriesState): StageSlot {
  if (sourceJob) return { kind: 'FOUND', job: sourceJob }
  return state.kind === 'LOADED' ? { kind: 'EMPTY' } : { kind: state.kind }
}

/** Ringkasan rangkaian untuk peringatan selisih barang; null selama belum termuat atau gagal. */
export function loadedSeries(state: JobSeriesState): readonly JobSummary[] | null {
  return state.kind === 'LOADED' ? state.summaries : null
}
