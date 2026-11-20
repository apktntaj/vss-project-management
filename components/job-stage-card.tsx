'use client'

// Kartu "Rangkaian job BC": satu kiriman international non-road = 1 job masuk (BC 2.3) + job
// BC 2.5 / BC 3.0 per disposisi barang CIPL. Menampilkan rangkaian, tombol buat job tahap yang
// belum ada (override manual), dan peringatan selisih barang CIPL vs job yang ada.

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { createStageJob, type Job } from '@/lib/data-client'
import { isDerivedJobStage } from '@/domain/job/types'
import { derivedStagesOf, jobStageLabel } from '@/domain/job/regime'
import { stageReconciliation } from '@/domain/job/stages'
import { jobNumberLabel } from '@/domain/job/numbering'
import type { DerivedJobStage } from '@/domain/job/types'
import { StatusBadge } from '@/components/status-badge'
import { GuardedButton } from '@/components/guarded-button'
import { notify } from '@/lib/notify'
import type { Denial } from '@/lib/write-access'
import { inboundSlot, loadedSeries, stageSlot, type JobSeriesState } from '@/lib/job-series'


const STAGE_NOUN: Record<DerivedJobStage, string> = {
  DISPOSAL: 'disposal',
  RE_EXPORT: 're-ekspor',
}

export function JobStageCard({
  job,
  sourceJob,
  series,
  onCreated,
  createDenial,
}: {
  job: Job
  /** Job masuk (BC 2.3) rangkaian ini; null bila gagal dimuat. */
  sourceJob: Job | null
  /** Job turunan aktif rangkaian ini (sudah disaring pemanggilnya) beserta keadaan pemuatannya. */
  series: JobSeriesState
  onCreated: () => void
  /** null = boleh membuat job turunan; string = alasan penolakan. */
  createDenial: Denial
}) {
  const [creating, setCreating] = useState<DerivedJobStage | null>(null)
  // Peringatan selisih hanya dihitung dari rangkaian yang sudah termuat.
  const loaded = loadedSeries(series)
  const warnings = loaded
    ? stageReconciliation(
        sourceJob?.ciplLines ?? [],
        loaded.map((summary) => summary.stage).filter(isDerivedJobStage),
        job.internationalJenis,
      )
    : []

  async function create(stage: DerivedJobStage) {
    setCreating(stage)
    try {
      await createStageJob(job.id, stage)
      notify(`Job ${jobStageLabel(job.internationalJenis, stage)} dibuat.`)
      onCreated()
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Job tidak dapat dibuat.', 'error')
    } finally {
      setCreating(null)
    }
  }

  // Tombol buat manual hanya di halaman job masuk yang belum batal.
  const canCreate = job.stage === 'INBOUND' && job.status !== 'CANCELLED'

  // Satu entri per tahap: job masuk, lalu tahap turunan jenis ini (mis. BC 2.5 dan BC 3.0).
  // `slot` membedakan memuat/gagal dari "memang belum ada" (EMPTY).
  const entries = [
    {
      stage: 'INBOUND' as const,
      slot: inboundSlot(sourceJob, series),
    },
    ...derivedStagesOf(job.internationalJenis).map((stage) => ({
      stage,
      slot: job.stage === stage ? ({ kind: 'EMPTY' } as const) : stageSlot(series, stage),
    })),
  ]

  return (
    <section className="card px-4 py-3" aria-labelledby="job-series-heading">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h2 id="job-series-heading" className="text-sm font-semibold">
          Rangkaian job
        </h2>
        <ol className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          {entries.map(({ stage, slot }, index) => (
            <li key={stage} className="flex items-center gap-2">
              {index > 0 && (
                <ChevronRight size={14} className="text-slate-400" aria-hidden="true" />
              )}
              <span className="font-medium text-slate-600">
                {jobStageLabel(job.internationalJenis, stage)}
              </span>
              {job.stage === stage ? (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-800">
                  Job ini
                </span>
              ) : slot.kind === 'LOADING' ? (
                <span className="text-slate-500" role="status">
                  Memuat…
                </span>
              ) : slot.kind === 'FAILED' ? (
                <span className="text-slate-500">Rangkaian gagal dimuat</span>
              ) : slot.kind === 'FOUND' ? (
                <>
                  <Link
                    href={`/jobs/${slot.job.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {jobNumberLabel(slot.job)}
                  </Link>
                  <StatusBadge status={slot.job.status} />
                </>
              ) : (
                <>
                  <span className="text-slate-500">Belum ada</span>
                  {canCreate && stage !== 'INBOUND' && (
                    <GuardedButton
                      denial={createDenial}
                      onClick={() => create(stage as DerivedJobStage)}
                      disabled={creating !== null}
                      className="btn-secondary !px-3 !py-1 text-xs"
                    >
                      {creating === stage
                        ? 'Membuat…'
                        : `Buat job ${jobStageLabel(job.internationalJenis, stage)}`}
                    </GuardedButton>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
      {warnings.map((warning) => (
        <p
          key={`${warning.kind}-${warning.stage}`}
          role="status"
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {warning.kind === 'MISSING'
            ? `Ada barang ${STAGE_NOUN[warning.stage]} di CIPL, tetapi job ${jobStageLabel(job.internationalJenis, warning.stage)} belum ada.`
            : `Job ${jobStageLabel(job.internationalJenis, warning.stage)} ada, tetapi tidak ada barang ${STAGE_NOUN[warning.stage]} di CIPL. Batalkan job itu bila tidak diperlukan.`}
        </p>
      ))}
    </section>
  )
}
