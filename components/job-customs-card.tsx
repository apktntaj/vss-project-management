'use client'

// Kartu "Dokumen BC" milik tahap job (BC 2.3 / 2.5 / 3.0): status, No AJU, No & tanggal
// Pendaftaran. Nomor Pendaftaran BC 3.0 inilah yang tercetak pada outward manifest.

import { useState } from 'react'

import {
  getOperationalDetails,
  saveJobOperationalDetails,
  type Job,
} from '@/lib/data-client'
import {
  bcDocumentLabels,
  jobCustomsStatusLabels,
  jobCustomsStatuses,
  jobStageBcDocument,
  type JobStage,
} from '@/domain/job/types'

const notify = (message: string, tone: 'success' | 'error' = 'success') =>
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))

export function JobCustomsCard({ job, onSaved }: { job: Job; onSaved: (job: Job) => void }) {
  // Hanya job bertahap yang punya dokumen BC (halaman sudah menjaga, ini pengetatan tipe).
  if (job.stage == null) return null
  return <CustomsForm key={job.id} job={job} stage={job.stage} onSaved={onSaved} />
}

function CustomsForm({
  job,
  stage,
  onSaved,
}: {
  job: Job
  stage: JobStage
  onSaved: (job: Job) => void
}) {
  const kind = jobStageBcDocument[stage]
  const document = getOperationalDetails(job).customs[kind]
  const [status, setStatus] = useState(document.status)
  const [ajuNumber, setAjuNumber] = useState(document.ajuNumber ?? '')
  const [registrationNumber, setRegistrationNumber] = useState(document.registrationNumber ?? '')
  const [registrationDate, setRegistrationDate] = useState(document.registrationDate ?? '')
  const [saving, setSaving] = useState(false)
  const disabled = job.status === 'CANCELLED'

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const base = getOperationalDetails(job)
      const saved = await saveJobOperationalDetails(job, {
        operational: {
          ...base,
          customs: {
            ...base.customs,
            [kind]: {
              ...base.customs[kind],
              status,
              ajuNumber: ajuNumber.trim() || null,
              registrationNumber: registrationNumber.trim() || null,
              registrationDate: registrationDate || null,
            },
          },
        },
      })
      onSaved(saved)
      notify(`Dokumen ${bcDocumentLabels[kind]} disimpan.`)
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Dokumen BC tidak dapat disimpan.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Dokumen {bcDocumentLabels[kind]}</h2>
      <form onSubmit={submit} className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="label">
          Status
          <select
            className="input mt-1"
            value={status}
            disabled={disabled}
            onChange={(event) =>
              setStatus(event.target.value as (typeof jobCustomsStatuses)[number])
            }
          >
            {jobCustomsStatuses.map((value) => (
              <option key={value} value={value}>
                {jobCustomsStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          No AJU
          <input
            className="input mt-1"
            value={ajuNumber}
            disabled={disabled}
            onChange={(event) => setAjuNumber(event.target.value)}
          />
        </label>
        <label className="label">
          No Pendaftaran
          <input
            className="input mt-1"
            value={registrationNumber}
            disabled={disabled}
            onChange={(event) => setRegistrationNumber(event.target.value)}
          />
        </label>
        <label className="label">
          Tanggal Pendaftaran
          <input
            type="date"
            className="input mt-1"
            value={registrationDate ?? ''}
            disabled={disabled}
            onChange={(event) => setRegistrationDate(event.target.value)}
          />
        </label>
        {!disabled && (
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        )}
      </form>
    </section>
  )
}
