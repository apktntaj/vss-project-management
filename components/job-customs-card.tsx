'use client'

// Kartu "Dokumen pabean" milik tahap job, mengikuti rezim (`stageCustomsDocument`): BC 2.3/2.5/3.0
// (TPPB), BC 2.0/3.0 (Temporary & Permanent Import), atau Carnet (ATA). Status, No AJU, No &
// tanggal pendaftaran; nomor pendaftaran inilah yang tercetak pada outward manifest. Job masuk
// ATA juga menyimpan identitas carnet, job masuk Temporary Import menyimpan jaminannya.

import { useState } from 'react'

import {
  getOperationalDetails,
  saveJobOperationalDetails,
  type Job,
} from '@/lib/data-client'
import {
  customsDocumentLabels,
  guaranteeKindLabels,
  guaranteeKinds,
  jobCustomsStatusLabels,
  jobCustomsStatuses,
  type CustomsDocumentKind,
  type JobStage,
} from '@/domain/job/types'
import { stageCustomsDocument } from '@/domain/job/regime'

const notify = (message: string, tone: 'success' | 'error' = 'success') =>
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))

export function JobCustomsCard({ job, onSaved }: { job: Job; onSaved: (job: Job) => void }) {
  // Hanya job bertahap yang punya dokumen pabean (halaman sudah menjaga, ini pengetatan tipe).
  if (job.stage == null) return null
  const kind = stageCustomsDocument(job.internationalJenis, job.stage)
  if (kind == null) return null
  return <CustomsForm key={job.id} job={job} stage={job.stage} kind={kind} onSaved={onSaved} />
}

function CustomsForm({
  job,
  stage,
  kind,
  onSaved,
}: {
  job: Job
  stage: JobStage
  kind: CustomsDocumentKind
  onSaved: (job: Job) => void
}) {
  const base = getOperationalDetails(job)
  const document = base.customs[kind]
  const carnet = base.carnet
  const guarantee = base.guarantee
  const isCarnet = kind === 'CARNET'
  const showCarnet = job.internationalJenis === 'ATA_CARNET' && stage === 'INBOUND'
  const showGuarantee = job.internationalJenis === 'TEMPORARY_IMPORT' && stage === 'INBOUND'
  const [status, setStatus] = useState(document?.status ?? 'NOT_STARTED')
  const [ajuNumber, setAjuNumber] = useState(document?.ajuNumber ?? '')
  const [registrationNumber, setRegistrationNumber] = useState(document?.registrationNumber ?? '')
  const [registrationDate, setRegistrationDate] = useState(document?.registrationDate ?? '')
  const [carnetNumber, setCarnetNumber] = useState(carnet?.number ?? '')
  const [carnetCountry, setCarnetCountry] = useState(carnet?.issuingCountry ?? '')
  const [carnetGuarantor, setCarnetGuarantor] = useState(carnet?.guarantor ?? '')
  const [carnetValidUntil, setCarnetValidUntil] = useState(carnet?.validUntil ?? '')
  const [guaranteeKind, setGuaranteeKind] = useState(guarantee?.kind ?? '')
  const [guaranteeNumber, setGuaranteeNumber] = useState(guarantee?.number ?? '')
  const [guaranteeAmount, setGuaranteeAmount] = useState(
    guarantee?.amount != null ? String(guarantee.amount) : '',
  )
  const [guaranteeCurrency, setGuaranteeCurrency] = useState(guarantee?.currency ?? '')
  const [guaranteeDeadline, setGuaranteeDeadline] = useState(guarantee?.reExportDeadline ?? '')
  const [saving, setSaving] = useState(false)
  const disabled = job.status === 'CANCELLED'

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const current = getOperationalDetails(job)
      const saved = await saveJobOperationalDetails(job, {
        operational: {
          ...current,
          customs: {
            ...current.customs,
            [kind]: {
              ...current.customs[kind],
              status,
              ajuNumber: ajuNumber.trim() || null,
              registrationNumber: registrationNumber.trim() || null,
              registrationDate: registrationDate || null,
            },
          },
          carnet: showCarnet
            ? {
                number: carnetNumber.trim() || null,
                issuingCountry: carnetCountry.trim() || null,
                guarantor: carnetGuarantor.trim() || null,
                validUntil: carnetValidUntil || null,
              }
            : current.carnet,
          guarantee: showGuarantee
            ? {
                kind: (guaranteeKind || null) as (typeof guaranteeKinds)[number] | null,
                number: guaranteeNumber.trim() || null,
                amount: guaranteeAmount.trim() ? Number(guaranteeAmount) : null,
                currency: guaranteeCurrency.trim() || null,
                reExportDeadline: guaranteeDeadline || null,
              }
            : current.guarantee,
        },
      })
      onSaved(saved)
      notify(`Dokumen ${customsDocumentLabels[kind]} disimpan.`)
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Dokumen pabean tidak dapat disimpan.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Dokumen {customsDocumentLabels[kind]}</h2>
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
        {!isCarnet && (
          <label className="label">
            No AJU
            <input
              className="input mt-1"
              value={ajuNumber}
              disabled={disabled}
              onChange={(event) => setAjuNumber(event.target.value)}
            />
          </label>
        )}
        <label className="label">
          {isCarnet ? 'No Voucher / Endorsemen' : 'No Pendaftaran'}
          <input
            className="input mt-1"
            value={registrationNumber}
            disabled={disabled}
            onChange={(event) => setRegistrationNumber(event.target.value)}
          />
        </label>
        <label className="label">
          {isCarnet ? 'Tanggal Endorsemen' : 'Tanggal Pendaftaran'}
          <input
            type="date"
            className="input mt-1"
            value={registrationDate ?? ''}
            disabled={disabled}
            onChange={(event) => setRegistrationDate(event.target.value)}
          />
        </label>
        {showCarnet && (
          <>
            <label className="label">
              Nomor Carnet
              <input
                className="input mt-1"
                value={carnetNumber}
                disabled={disabled}
                onChange={(event) => setCarnetNumber(event.target.value)}
              />
            </label>
            <label className="label">
              Negara Penerbit
              <input
                className="input mt-1"
                value={carnetCountry}
                disabled={disabled}
                onChange={(event) => setCarnetCountry(event.target.value)}
              />
            </label>
            <label className="label">
              Penjamin
              <input
                className="input mt-1"
                placeholder="KADIN Indonesia"
                value={carnetGuarantor}
                disabled={disabled}
                onChange={(event) => setCarnetGuarantor(event.target.value)}
              />
            </label>
            <label className="label">
              Berlaku s.d.
              <input
                type="date"
                className="input mt-1"
                value={carnetValidUntil ?? ''}
                disabled={disabled}
                onChange={(event) => setCarnetValidUntil(event.target.value)}
              />
            </label>
          </>
        )}
        {showGuarantee && (
          <>
            <label className="label">
              Jenis Jaminan
              <select
                className="input mt-1"
                value={guaranteeKind}
                disabled={disabled}
                onChange={(event) => setGuaranteeKind(event.target.value)}
              >
                <option value="">—</option>
                {guaranteeKinds.map((value) => (
                  <option key={value} value={value}>
                    {guaranteeKindLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Nomor Jaminan
              <input
                className="input mt-1"
                value={guaranteeNumber}
                disabled={disabled}
                onChange={(event) => setGuaranteeNumber(event.target.value)}
              />
            </label>
            <label className="label">
              Nilai Jaminan
              <input
                type="number"
                min="0"
                className="input mt-1"
                value={guaranteeAmount}
                disabled={disabled}
                onChange={(event) => setGuaranteeAmount(event.target.value)}
              />
            </label>
            <label className="label">
              Valuta
              <input
                className="input mt-1"
                placeholder="USD / IDR"
                value={guaranteeCurrency}
                disabled={disabled}
                onChange={(event) => setGuaranteeCurrency(event.target.value)}
              />
            </label>
            <label className="label">
              Tenggat Re-ekspor
              <input
                type="date"
                className="input mt-1"
                value={guaranteeDeadline ?? ''}
                disabled={disabled}
                onChange={(event) => setGuaranteeDeadline(event.target.value)}
              />
            </label>
          </>
        )}
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
