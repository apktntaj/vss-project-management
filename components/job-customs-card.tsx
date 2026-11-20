'use client'

// Kartu "Dokumen pabean" milik tahap job, mengikuti rezim (`stageCustomsDocument`): BC 2.3/2.5/3.0
// (TPPB), BC 2.0/3.0 (Temporary & Permanent Import), atau Carnet (ATA). Status, No AJU, No &
// tanggal pendaftaran; nomor pendaftaran inilah yang tercetak pada outward manifest. Job masuk
// ATA juga menyimpan identitas carnet, job masuk Temporary Import menyimpan jaminannya; job
// re-ekspor ATA menampilkan identitas carnet read-only dari job masuknya (`source`).

import { useState } from 'react'
import Link from 'next/link'

import { GuardedButton } from '@/components/guarded-button'
import { notify } from '@/lib/notify'
import type { Denial } from '@/lib/write-access'
import { jobNumberLabel } from '@/domain/job/numbering'
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

const fieldClass = 'input mt-1 disabled:bg-slate-50 disabled:text-slate-600'

export function JobCustomsCard({
  job,
  source,
  onSaved,
  denial,
}: {
  job: Job
  source?: Job | null
  onSaved: (job: Job) => void
  /** null = boleh mengubah; string = alasan penolakan (form tampil sebagai data baca). */
  denial: Denial
}) {
  // Hanya job bertahap yang punya dokumen pabean (halaman sudah menjaga, ini pengetatan tipe).
  if (job.stage == null) return null
  const kind = stageCustomsDocument(job.internationalJenis, job.stage)
  if (kind == null) return null
  return (
    <CustomsForm
      key={job.id}
      job={job}
      source={source}
      stage={job.stage}
      kind={kind}
      onSaved={onSaved}
      denial={denial}
    />
  )
}

function CustomsForm({
  job,
  source,
  stage,
  kind,
  onSaved,
  denial,
}: {
  job: Job
  source?: Job | null
  stage: JobStage
  kind: CustomsDocumentKind
  onSaved: (job: Job) => void
  denial: Denial
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
  const [warehouseName, setWarehouseName] = useState(document?.warehouseName ?? '')
  const [saving, setSaving] = useState(false)
  const cancelled = job.status === 'CANCELLED'
  const disabled = cancelled || typeof denial === 'string'

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
              // Gudang/TPS hanya untuk dokumen BC; Carnet tidak punya gudang.
              warehouseName: isCarnet ? current.customs[kind].warehouseName : warehouseName.trim() || null,
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
    <section className="card p-5" aria-labelledby="job-customs-heading">
      <h2 id="job-customs-heading" className="font-semibold">
        Dokumen {customsDocumentLabels[kind]}
      </h2>
      <form onSubmit={submit} className="mt-3 space-y-6">
        <fieldset disabled={disabled} className="min-w-0 space-y-6 border-0 p-0">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              {isCarnet ? 'Endorsemen' : 'Pendaftaran'}
            </h3>
            <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="label">
                Status
                <select
                  className={fieldClass}
                  value={status}
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
                    className={fieldClass}
                    value={ajuNumber}
                    onChange={(event) => setAjuNumber(event.target.value)}
                  />
                </label>
              )}
              <label className="label">
                {isCarnet ? 'No Voucher / Endorsemen' : 'No Pendaftaran'}
                <input
                  className={fieldClass}
                  value={registrationNumber}
                  onChange={(event) => setRegistrationNumber(event.target.value)}
                />
              </label>
              <label className="label">
                {isCarnet ? 'Tanggal Endorsemen' : 'Tanggal Pendaftaran'}
                <input
                  type="date"
                  className={fieldClass}
                  value={registrationDate ?? ''}
                  onChange={(event) => setRegistrationDate(event.target.value)}
                />
              </label>
              {!isCarnet && (
                <label className="label sm:col-span-2">
                  Gudang / TPS
                  <input
                    className={fieldClass}
                    maxLength={200}
                    placeholder="Nama gudang atau TPS tempat barang ditimbun"
                    value={warehouseName}
                    onChange={(event) => setWarehouseName(event.target.value)}
                  />
                </label>
              )}
            </div>
          </div>
          {showCarnet && (
            <div className="border-t border-black/10 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">Identitas Carnet</h3>
              <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="label">
                  Nomor Carnet
                  <input
                    className={fieldClass}
                    value={carnetNumber}
                    onChange={(event) => setCarnetNumber(event.target.value)}
                  />
                </label>
                <label className="label">
                  Negara Penerbit
                  <input
                    className={fieldClass}
                    value={carnetCountry}
                    onChange={(event) => setCarnetCountry(event.target.value)}
                  />
                </label>
                <label className="label">
                  Penjamin
                  <input
                    className={fieldClass}
                    placeholder="KADIN Indonesia"
                    value={carnetGuarantor}
                    onChange={(event) => setCarnetGuarantor(event.target.value)}
                  />
                </label>
                <label className="label">
                  Berlaku s.d.
                  <input
                    type="date"
                    className={fieldClass}
                    value={carnetValidUntil ?? ''}
                    onChange={(event) => setCarnetValidUntil(event.target.value)}
                  />
                </label>
              </div>
            </div>
          )}
          {showGuarantee && (
            <div className="border-t border-black/10 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">Jaminan</h3>
              <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="label">
                  Jenis Jaminan
                  <select
                    className={fieldClass}
                    value={guaranteeKind}
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
                    className={fieldClass}
                    value={guaranteeNumber}
                    onChange={(event) => setGuaranteeNumber(event.target.value)}
                  />
                </label>
                <label className="label">
                  Nilai Jaminan
                  <input
                    type="number"
                    min="0"
                    className={fieldClass}
                    value={guaranteeAmount}
                    onChange={(event) => setGuaranteeAmount(event.target.value)}
                  />
                </label>
                <label className="label">
                  Valuta
                  <input
                    className={fieldClass}
                    placeholder="USD / IDR"
                    value={guaranteeCurrency}
                    onChange={(event) => setGuaranteeCurrency(event.target.value)}
                  />
                </label>
                <label className="label">
                  Tenggat Re-ekspor
                  <input
                    type="date"
                    className={fieldClass}
                    value={guaranteeDeadline ?? ''}
                    onChange={(event) => setGuaranteeDeadline(event.target.value)}
                  />
                </label>
              </div>
            </div>
          )}
        </fieldset>
        {!cancelled && (
          <div>
            <GuardedButton type="submit" denial={denial} className="btn-primary" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </GuardedButton>
          </div>
        )}
      </form>
      {isCarnet && job.sourceJobId != null && source != null && (
        <CarnetIdentity source={source} />
      )}
      {isCarnet && job.sourceJobId != null && source == null && (
        <p className="mt-4 border-t border-black/10 pt-3 text-sm text-slate-600">
          Identitas carnet dari job masuk belum dapat dimuat.
        </p>
      )}
    </section>
  )
}

/** Identitas carnet job re-ekspor ATA: milik job masuknya, hanya dibaca (diubah di job masuk). */
function CarnetIdentity({ source }: { source: Job }) {
  const carnet = getOperationalDetails(source).carnet
  const fields: Array<[label: string, value: string | null]> = carnet
    ? [
        ['Nomor Carnet', carnet.number],
        ['Negara Penerbit', carnet.issuingCountry],
        ['Penjamin', carnet.guarantor],
        ['Berlaku s.d.', carnet.validUntil],
      ]
    : []
  return (
    <div className="mt-4 border-t border-black/10 pt-3">
      <h3 className="text-sm font-semibold text-slate-700">Identitas carnet (diisi di job masuk)</h3>
      {fields.some(([, value]) => value != null && value !== '') ? (
        <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-600">{label}</dt>
              <dd className="font-medium text-slate-800">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Belum diisi di job masuknya — lengkapi di tab Pabean{' '}
          <Link href={`/jobs/${source.id}?tab=pabean`} className="font-medium text-foreground underline underline-offset-2">
            job masuk {jobNumberLabel(source)}
          </Link>
          .
        </p>
      )}
    </div>
  )
}
