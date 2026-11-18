'use client'

import { Check } from 'lucide-react'

import type { Job } from '@/lib/data-client'
import {
  buildJobReadiness,
  type JobDetailTab,
  type JobReadinessTarget,
  type JobReadinessStepState,
} from '@/lib/job-readiness'

// Stepper milestone job di header halaman detail: lima langkah progres (bukan form), tiap langkah
// menuju tab area kerja (atau dialog header) yang memuat datanya. Klik langkah pada tab aktif
// tidak melakukan apa pun.

const dotClassNames: Record<JobReadinessStepState, string> = {
  todo: 'rounded-full border-2 border-slate-300',
  doing: 'rounded-full bg-amber-500',
  done: 'rounded-full bg-emerald-600 text-white',
}

const stateText: Record<JobReadinessStepState, string> = {
  todo: 'belum dimulai',
  doing: 'sedang berjalan',
  done: 'selesai',
}

export function JobReadinessBar({
  job,
  activeTab,
  onNavigate,
}: {
  job: Job
  activeTab: JobDetailTab
  onNavigate: (target: JobReadinessTarget) => void
}) {
  const readiness = buildJobReadiness(job)
  return (
    <section className="card p-5" aria-labelledby="job-milestone-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="job-milestone-heading" className="text-sm font-semibold">
          Progress Job
        </h2>
        <p className="text-xs text-slate-600">
          {readiness.doneCount}/{readiness.steps.length} selesai
        </p>
      </div>
      <ol className="mt-3 space-y-0.5">
        {readiness.steps.map((step) => {
          const current = step.tab === activeTab
          return (
            <li key={step.key}>
              <button
                type="button"
                onClick={() => !current && onNavigate(step.tab)}
                aria-current={current ? 'step' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                  current
                    ? 'border-slate-300 bg-slate-50'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex size-4 shrink-0 items-center justify-center ${dotClassNames[step.state]}`}
                  aria-hidden="true"
                >
                  {step.state === 'done' && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-800">
                  {step.label}
                  <span className="sr-only"> — {stateText[step.state]}</span>
                </span>
                <span className="ml-auto min-w-0 truncate text-xs text-slate-600" title={step.detail}>
                  {step.detail}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
