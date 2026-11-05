'use client'

import { Check } from 'lucide-react'

import type { Job } from '@/lib/data-client'
import {
  buildJobReadiness,
  type JobDetailTab,
  type JobReadinessTarget,
  type JobReadinessStepState,
} from '@/lib/job-readiness'

// Stepper kesiapan job di header halaman detail: lima langkah progres (bukan form), tiap langkah
// menuju tab area kerja (atau dialog header) yang memuat datanya. Klik langkah pada tab aktif
// tidak melakukan apa pun.

const dotClassNames: Record<JobReadinessStepState, string> = {
  todo: 'rounded-full border-2 border-slate-300',
  doing: 'rounded-full bg-amber-500',
  done: 'rounded-full bg-emerald-600 text-white',
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
    <section className="card p-5">
      <p className="text-sm font-semibold">Kesiapan Job</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        {readiness.steps.map((step) => (
          <button
            key={step.key}
            type="button"
            onClick={() => step.tab !== activeTab && onNavigate(step.tab)}
            className="flex items-start gap-2.5 text-left"
          >
            <span
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center ${dotClassNames[step.state]}`}
            >
              {step.state === 'done' && <Check size={11} strokeWidth={3} aria-hidden="true" />}
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800">{step.label}</span>
              <span className="block text-xs text-slate-500">{step.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
