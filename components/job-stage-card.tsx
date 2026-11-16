'use client'

// Kartu "Rangkaian job BC": satu kiriman international non-road = 1 job masuk (BC 2.3) + job
// BC 2.5 / BC 3.0 per disposisi barang CIPL. Menampilkan rangkaian, tombol buat job tahap yang
// belum ada (override manual), dan peringatan selisih barang CIPL vs job yang ada.

import { useState } from 'react'
import Link from 'next/link'

import { createStageJob, type Job, type JobSummary } from '@/lib/data-client'
import { derivedJobStages, isDerivedJobStage, jobStageLabel } from '@/domain/job/types'
import { stageReconciliation } from '@/domain/job/stages'
import { jobNumberLabel } from '@/domain/job/numbering'
import type { DerivedJobStage } from '@/domain/job/types'
import { StatusBadge } from '@/components/status-badge'

const notify = (message: string, tone: 'success' | 'error' = 'success') =>
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))

const STAGE_NOUN: Record<DerivedJobStage, string> = {
  DISPOSAL: 'disposal',
  RE_EXPORT: 're-ekspor',
}

export function JobStageCard({
  job,
  sourceJob,
  series,
  onCreated,
}: {
  job: Job
  /** Job masuk (BC 2.3) rangkaian ini; null bila gagal dimuat. */
  sourceJob: Job | null
  /** Job turunan aktif rangkaian ini (sudah disaring pemanggilnya). */
  series: JobSummary[]
  onCreated: () => void
}) {
  const [creating, setCreating] = useState<DerivedJobStage | null>(null)
  const stagesById = new Map(series.map((summary) => [summary.stage, summary]))
  const warnings = stageReconciliation(
    sourceJob?.ciplLines ?? [],
    series
      .map((summary) => summary.stage)
      .filter(isDerivedJobStage),
  )

  async function create(stage: DerivedJobStage) {
    setCreating(stage)
    try {
      await createStageJob(job.id, stage)
      notify(`Job ${jobStageLabel(stage)} dibuat.`)
      onCreated()
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Job tidak dapat dibuat.', 'error')
    } finally {
      setCreating(null)
    }
  }

  // Tombol buat manual hanya di halaman job masuk yang belum batal.
  const canCreate = job.stage === 'INBOUND' && job.status !== 'CANCELLED'

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Rangkaian job BC</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="w-20 shrink-0 font-medium text-slate-500">BC 2.3</dt>
          <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {job.stage === 'INBOUND' ? (
              <span className="text-slate-700">Job ini</span>
            ) : sourceJob ? (
              <>
                <Link
                  href={`/jobs/${sourceJob.id}`}
                  className="truncate font-medium text-slate-800 hover:text-slate-900"
                >
                  {jobNumberLabel(sourceJob)}
                </Link>
                <StatusBadge status={sourceJob.status} />
              </>
            ) : (
              <span className="text-slate-400">Belum ada</span>
            )}
          </dd>
        </div>
        {derivedJobStages.map((stage) => {
          const other = stagesById.get(stage)
          return (
            <div key={stage} className="flex flex-wrap items-center gap-2">
              <dt className="w-20 shrink-0 font-medium text-slate-500">
                {jobStageLabel(stage)}
              </dt>
              <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {job.stage === stage ? (
                  <span className="text-slate-700">Job ini</span>
                ) : other ? (
                  <>
                    <Link
                      href={`/jobs/${other.id}`}
                      className="truncate font-medium text-slate-800 hover:text-slate-900"
                    >
                      {jobNumberLabel(other)}
                    </Link>
                    <StatusBadge status={other.status} />
                  </>
                ) : (
                  <>
                    <span className="text-slate-400">Belum ada</span>
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => create(stage)}
                        disabled={creating !== null}
                        className="btn-secondary"
                      >
                        {creating === stage ? 'Membuat…' : `Buat job ${jobStageLabel(stage)}`}
                      </button>
                    )}
                  </>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
      {warnings.map((warning) => (
        <p
          key={`${warning.kind}-${warning.stage}`}
          role="status"
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {warning.kind === 'MISSING'
            ? `Ada barang ${STAGE_NOUN[warning.stage]} di CIPL, tetapi job ${jobStageLabel(warning.stage)} belum ada.`
            : `Job ${jobStageLabel(warning.stage)} ada, tetapi tidak ada barang ${STAGE_NOUN[warning.stage]} di CIPL. Batalkan job itu bila tidak diperlukan.`}
        </p>
      ))}
    </section>
  )
}
