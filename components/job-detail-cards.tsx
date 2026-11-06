'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, FileText, Pencil, Save, ShipWheel, Sparkles } from 'lucide-react'
import {
  getNextManifestSeq,
  getOperationalDetails,
  saveJobOperationalDetails,
  type Job,
  type JobDetailsInput,
  type JobDocumentKind,
  type JobOperationalAttachment,
} from '@/lib/data-client'
import {
  bcDocumentKinds,
  bcDocumentLabels,
  jobCustomsStatuses,
  jobStatuses,
  transportModeLabels,
  transportModes,
  type BcDocumentKind,
  type JobCiplSourceKind,
  type JobCustomsDocument,
  type JobStatus,
  type JobTransportLeg,
  type TransportMode,
} from '@/domain/job/types'
import { ciplStatusText, deriveCiplStatus } from '@/domain/job/cipl-status'
import { formatJobNumber, formatManifestSequence } from '@/domain/job/numbering'

// Editor per-area di halaman detail job: tiap kartu menampilkan ringkasan read-only dan, saat
// "Ubah" ditekan, menyuntik form di tempat yang sama (pola kartu Pihak · Tagihan). Simpan selalu
// patch SEMPIT lewat `saveJobOperationalDetails` lalu mengangkat job terbaru ke pemanggil
// (`onSaved` → `setJob`). Alur scan+ekstraksi berat (manifest, B/L, CIPL) tetap modal tersendiri.

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

const text = (form: FormData, key: string) => String(form.get(key) || '').trim() || null

const fmtDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
    : 'Belum diisi'

const customsStatusLabels: Record<(typeof jobCustomsStatuses)[number], string> = {
  NOT_STARTED: 'Belum mulai',
  PREPARING: 'Disiapkan',
  SUBMITTED: 'Diajukan',
  REGISTERED: 'Terdaftar',
  RELEASED: 'Release',
  COMPLETED: 'Selesai',
  ON_HOLD: 'Ditunda',
}

const jobStatusLabels: Record<JobStatus, string> = {
  DRAFT: 'Draf',
  IN_PROGRESS: 'Sedang diproses',
  ON_HOLD: 'Ditunda',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
}

const legModeLabels: Record<NonNullable<JobTransportLeg['mode']>, string> = {
  SEA: 'Laut',
  AIR: 'Udara',
  LOCAL: 'Lokal',
}

/** Patch + simpan + angkat job baru; menutup editor saat sukses. */
function useJobSave(job: Job, onSaved: (job: Job) => void, close: () => void) {
  const [saving, setSaving] = useState(false)
  async function save(patch: JobDetailsInput, attachments: JobOperationalAttachment[] = []) {
    setSaving(true)
    try {
      const next = await saveJobOperationalDetails(job, patch, attachments)
      notify('Job diperbarui.', 'success')
      onSaved(next)
      close()
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Job tidak dapat disimpan.', 'error')
    } finally {
      setSaving(false)
    }
  }
  return { saving, save }
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800"
    >
      <Pencil size={12} aria-hidden="true" /> Ubah
    </button>
  )
}

function FormActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="btn-secondary" disabled={saving}>
        Batal
      </button>
      <button className="btn-primary" disabled={saving}>
        <Save size={16} /> {saving ? 'Menyimpan…' : 'Simpan'}
      </button>
    </div>
  )
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value ?? 'Belum diisi'}</dd>
    </div>
  )
}

function CardHeader({
  title,
  icon,
  editing,
  onEdit,
}: {
  title: string
  icon?: ReactNode
  editing: boolean
  onEdit: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h2>
      {editing ? null : <EditButton onClick={onEdit} />}
    </div>
  )
}

// --------------------------------------------------------------------------------------------
// Header job: No Job (jalur → awalan, urutan dengan saran, No. commercial invoice), status, dan
// remark dalam satu form; dibuka sebagai dialog dari header halaman detail (bukan tab).
// --------------------------------------------------------------------------------------------

function HeaderForm({ job, onSaved, onCancel }: { job: Job; onSaved: (job: Job) => void; onCancel: () => void }) {
  const { saving, save } = useJobSave(job, onSaved, onCancel)
  const [transportMode, setTransportMode] = useState<TransportMode | ''>(job.transportMode ?? '')
  const [seq, setSeq] = useState(job.manifestSeq ? String(job.manifestSeq) : '')
  const [invoiceNumber, setInvoiceNumber] = useState(job.commercialInvoiceNumber ?? '')
  const [status, setStatus] = useState<JobStatus>(job.status)
  const [notes, setNotes] = useState(job.notes ?? '')
  const [suggestion, setSuggestion] = useState<number | null>(null)
  const modeChanged = (transportMode || null) !== job.transportMode

  useEffect(() => {
    // Saran dihitung dari awalan yang tersimpan; bila jalur baru diubah, simpan dulu lalu minta saran.
    if (modeChanged) {
      setSuggestion(null)
      return
    }
    getNextManifestSeq(job.id)
      .then((result) => setSuggestion(result.suggestedSeq))
      .catch(() => setSuggestion(null))
  }, [job.id, job.version, modeChanged])

  const preview = formatJobNumber(
    modeChanged ? null : job.manifestPrefix,
    seq.trim() ? Number(seq.trim()) : null,
    invoiceNumber.trim() || null,
  )

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedSeq = seq.trim()
    const manifestSeq = trimmedSeq ? Number(trimmedSeq) : null
    if (manifestSeq !== null && (!Number.isInteger(manifestSeq) || manifestSeq < 1)) {
      notify('Urutan No Job harus bilangan bulat ≥ 1.', 'error')
      return
    }
    const patch: JobDetailsInput = {
      status,
      notes: notes.trim() || null,
      commercialInvoiceNumber: invoiceNumber.trim() || null,
      ...(modeChanged ? { transportMode: transportMode || null } : {}),
      ...(modeChanged ? {} : { manifestSeq }),
    }
    void save(patch)
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">
          Jalur
          <select
            className="input mt-1"
            value={transportMode}
            disabled={job.internationalJenis === 'ROAD_SHIPMENT'}
            onChange={(event) => setTransportMode(event.target.value as TransportMode | '')}
          >
            <option value="">Belum diisi</option>
            {transportModes.map((mode) => (
              <option key={mode} value={mode}>
                {transportModeLabels[mode]}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Urutan No Job
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min="1"
              className="input"
              value={seq}
              disabled={modeChanged || !job.manifestPrefix}
              onChange={(event) => setSeq(event.target.value)}
            />
            {suggestion !== null && !modeChanged && (
              <button
                type="button"
                className="btn-secondary shrink-0"
                title="Urutan berikutnya untuk awalan ini di event ini"
                onClick={() => setSeq(String(suggestion))}
              >
                <Sparkles size={14} /> {job.manifestPrefix}.{formatManifestSequence(suggestion)}
              </button>
            )}
          </div>
        </label>
        <label className="label">
          No. commercial invoice
          <input
            className="input mt-1"
            value={invoiceNumber}
            placeholder="234YFN"
            onChange={(event) => setInvoiceNumber(event.target.value)}
          />
        </label>
        <label className="label">
          Status Job
          <select
            className="input mt-1"
            value={status}
            onChange={(event) => setStatus(event.target.value as JobStatus)}
          >
            {jobStatuses.map((value) => (
              <option key={value} value={value}>
                {jobStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="label sm:col-span-2">
          Remark
          <textarea
            className="input mt-1 min-h-24"
            value={notes}
            placeholder="Catatan operasional job"
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {modeChanged
          ? 'Simpan jalur dulu — awalan No Job ditentukan jalur + jenis job. Urutan bisa diisi setelah itu.'
          : !job.manifestPrefix
            ? 'Isi jalur dulu untuk mendapatkan awalan No Job.'
            : `Pratinjau: ${preview ?? `${job.manifestPrefix}.-`}. Urutan mengikuti barang yang datang lebih dulu.`}
      </p>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

export function JobHeaderDialog({
  job,
  open,
  onClose,
  onSaved,
}: {
  job: Job
  open: boolean
  onClose: () => void
  onSaved: (job: Job) => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-header-title"
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 id="job-header-title" className="text-lg font-bold">
          Ubah header job
        </h2>
        <HeaderForm job={job} onSaved={onSaved} onCancel={onClose} />
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------------------------
// Perjalanan: leg masuk & keluar (moda, carrier, jadwal, aktual). Nomor B/L/AWB bukan di sini —
// itu milik dokumen angkut (diedit lewat dialog "Scan / edit B/L atau AWB").
// --------------------------------------------------------------------------------------------

function LegFields({ prefix, title, leg }: { prefix: 'inbound' | 'outbound'; title: string; leg: JobTransportLeg }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="label">
          Moda
          <select name={`${prefix}.mode`} defaultValue={leg.mode || ''} className="input mt-1">
            <option value="">Belum ditentukan</option>
            <option value="SEA">Laut</option>
            <option value="AIR">Udara</option>
            <option value="LOCAL">Lokal</option>
          </select>
        </label>
        <label className="label">
          Carrier
          <input name={`${prefix}.carrier`} defaultValue={leg.carrier || ''} className="input mt-1" />
        </label>
        <label className="label">
          Jadwal (ETA / ETD)
          <input
            type="date"
            name={`${prefix}.scheduleAt`}
            defaultValue={leg.scheduleAt?.slice(0, 10) || ''}
            className="input mt-1"
          />
        </label>
        <label className="label">
          Tanggal aktual
          <input
            type="date"
            name={`${prefix}.actualAt`}
            defaultValue={leg.actualAt?.slice(0, 10) || ''}
            className="input mt-1"
          />
        </label>
      </div>
    </section>
  )
}

function JourneyForm({ job, onSaved, onCancel }: { job: Job; onSaved: (job: Job) => void; onCancel: () => void }) {
  const { saving, save } = useJobSave(job, onSaved, onCancel)
  const operational = getOperationalDetails(job)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const leg = (prefix: 'inbound' | 'outbound'): JobTransportLeg => ({
      mode: (form.get(`${prefix}.mode`) || null) as JobTransportLeg['mode'],
      carrier: text(form, `${prefix}.carrier`),
      scheduleAt: text(form, `${prefix}.scheduleAt`),
      actualAt: text(form, `${prefix}.actualAt`),
    })
    void save({ operational: { ...operational, inbound: leg('inbound'), outbound: leg('outbound') } })
  }
  return (
    <form onSubmit={submit} className="mt-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <LegFields prefix="inbound" title="Perjalanan masuk" leg={operational.inbound} />
        <LegFields prefix="outbound" title="Perjalanan keluar" leg={operational.outbound} />
      </div>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

export function JobJourneyCard({ job, onSaved }: { job: Job; onSaved: (job: Job) => void }) {
  const [editing, setEditing] = useState(false)
  const operational = getOperationalDetails(job)
  return (
    <section className="card p-5">
      <CardHeader
        title="Perjalanan"
        icon={<ShipWheel size={20} className="text-orange-600" aria-hidden="true" />}
        editing={editing}
        onEdit={() => setEditing(true)}
      />
      {editing ? (
        <JourneyForm job={job} onSaved={onSaved} onCancel={() => setEditing(false)} />
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(
            [
              ['Masuk', operational.inbound],
              ['Keluar', operational.outbound],
            ] as const
          ).map(([title, leg]) => (
            <div key={title} className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-800">{title}</p>
              <p className="mt-2 text-sm text-slate-600">
                {leg.mode ? legModeLabels[leg.mode] : 'Belum direncanakan'}
              </p>
              {title === 'Masuk' && (
                <p className="mt-1 text-sm font-medium">
                  {job.transportDocumentNumber
                    ? `${job.transportDocumentType ?? 'Dokumen'} ${job.transportDocumentNumber}`
                    : 'Nomor B/L/AWB belum diisi'}
                </p>
              )}
              <p className="mt-1 text-sm text-slate-600">Vessel: {leg.carrier || '—'}</p>
              <p className="mt-3 text-xs text-slate-500">
                Jadwal: {fmtDate(leg.scheduleAt)} · Aktual: {fmtDate(leg.actualAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// --------------------------------------------------------------------------------------------
// Logistik: empty storage & re-export.
// --------------------------------------------------------------------------------------------

function LogisticsForm({ job, onSaved, onCancel }: { job: Job; onSaved: (job: Job) => void; onCancel: () => void }) {
  const { saving, save } = useJobSave(job, onSaved, onCancel)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void save({ emptyStorage: text(form, 'emptyStorage'), reExport: text(form, 'reExport') })
  }
  return (
    <form onSubmit={submit} className="mt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">
          Empty storage
          <input
            name="emptyStorage"
            defaultValue={job.emptyStorage || ''}
            className="input mt-1"
            placeholder="Penyimpanan kemasan kosong"
          />
        </label>
        <label className="label">
          Re-export
          <input
            name="reExport"
            defaultValue={job.reExport || ''}
            className="input mt-1"
            placeholder="Rencana / status re-ekspor"
          />
        </label>
      </div>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

export function JobLogisticsCard({ job, onSaved }: { job: Job; onSaved: (job: Job) => void }) {
  const [editing, setEditing] = useState(false)
  return (
    <section className="card p-5">
      <CardHeader title="Logistik" editing={editing} onEdit={() => setEditing(true)} />
      {editing ? (
        <LogisticsForm job={job} onSaved={onSaved} onCancel={() => setEditing(false)} />
      ) : (
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          <Info label="Empty storage" value={job.emptyStorage || '—'} />
          <Info label="Re-export" value={job.reExport || '—'} />
        </dl>
      )}
    </section>
  )
}

// --------------------------------------------------------------------------------------------
// Dokumen kepabeanan: empat BC (diperlukan, status, aju, nopen, tanggal, gudang) + lampiran PDF.
// --------------------------------------------------------------------------------------------

function CustomsFields({ kind, detail }: { kind: BcDocumentKind; detail: JobCustomsDocument }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{bcDocumentLabels[kind]}</h3>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            name={`${kind}.applicable`}
            defaultChecked={detail.applicable}
            className="h-4 w-4 accent-orange-600"
          />{' '}
          Diperlukan
        </label>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="label">
          Status
          <select name={`${kind}.status`} defaultValue={detail.status} className="input mt-1">
            {jobCustomsStatuses.map((status) => (
              <option key={status} value={status}>
                {customsStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Nomor aju
          <input name={`${kind}.ajuNumber`} defaultValue={detail.ajuNumber || ''} className="input mt-1" />
        </label>
        <label className="label">
          Nopen
          <input
            name={`${kind}.registrationNumber`}
            defaultValue={detail.registrationNumber || ''}
            className="input mt-1"
          />
        </label>
        <label className="label">
          Tanggal Nopen
          <input
            name={`${kind}.registrationDate`}
            type="date"
            defaultValue={detail.registrationDate || ''}
            className="input mt-1"
          />
        </label>
        <label className="label">
          Gudang
          <input
            name={`${kind}.warehouseName`}
            defaultValue={detail.warehouseName || ''}
            className="input mt-1"
          />
        </label>
        <label className="label">
          Lampiran PDF
          <input
            name={`attachment:${kind}`}
            type="file"
            accept="application/pdf"
            className="mt-2 block w-full text-sm text-slate-600"
          />
        </label>
      </div>
    </section>
  )
}

function CustomsForm({ job, onSaved, onCancel }: { job: Job; onSaved: (job: Job) => void; onCancel: () => void }) {
  const { saving, save } = useJobSave(job, onSaved, onCancel)
  const operational = getOperationalDetails(job)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const document = (kind: BcDocumentKind): JobCustomsDocument => ({
      applicable: form.get(`${kind}.applicable`) === 'on',
      status: String(form.get(`${kind}.status`)) as JobCustomsDocument['status'],
      ajuNumber: text(form, `${kind}.ajuNumber`),
      registrationNumber: text(form, `${kind}.registrationNumber`),
      registrationDate: text(form, `${kind}.registrationDate`),
      warehouseName: text(form, `${kind}.warehouseName`),
    })
    const attachments = bcDocumentKinds.flatMap((kind) => {
      const file = form.get(`attachment:${kind}`)
      return file instanceof File && file.size ? [{ kind: kind as JobDocumentKind, file }] : []
    })
    const customs = Object.fromEntries(bcDocumentKinds.map((kind) => [kind, document(kind)])) as Record<
      BcDocumentKind,
      JobCustomsDocument
    >
    void save({ operational: { ...operational, customs } }, attachments)
  }
  return (
    <form onSubmit={submit} className="mt-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {bcDocumentKinds.map((kind) => (
          <CustomsFields key={kind} kind={kind} detail={operational.customs[kind]} />
        ))}
      </div>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

export function JobCustomsCard({ job, onSaved }: { job: Job; onSaved: (job: Job) => void }) {
  const [editing, setEditing] = useState(false)
  const operational = getOperationalDetails(job)
  return (
    <section className="card p-5">
      <CardHeader
        title="Dokumen kepabeanan"
        icon={<FileText size={20} className="text-orange-600" aria-hidden="true" />}
        editing={editing}
        onEdit={() => setEditing(true)}
      />
      {editing ? (
        <CustomsForm job={job} onSaved={onSaved} onCancel={() => setEditing(false)} />
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {bcDocumentKinds.map((kind) => {
            const document = operational.customs[kind]
            return (
              <div key={kind} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{bcDocumentLabels[kind]}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${!document.applicable ? 'bg-slate-100 text-slate-500' : document.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}
                  >
                    {document.applicable ? customsStatusLabels[document.status] : 'Tidak diperlukan'}
                  </span>
                </div>
                {document.applicable && (
                  <dl className="mt-4 space-y-3">
                    <Info label="Nomor aju" value={document.ajuNumber || '—'} />
                    <Info label="Nopen" value={document.registrationNumber || '—'} />
                    <Info label="Tanggal Nopen" value={fmtDate(document.registrationDate)} />
                    <Info label="Gudang" value={document.warehouseName || '—'} />
                  </dl>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// --------------------------------------------------------------------------------------------
// CIPL: status DITURUNKAN dari berkas lampiran + data job (`deriveCiplStatus`); tidak ada field
// manual. Entri & scan dokumen (CIPL/packing list maupun inward manifest) lewat CiplEntryModal
// (tombol "Tambah / scan dokumen"); nomor invoice diubah lewat header job.
// --------------------------------------------------------------------------------------------

const ciplSourceLabels: Record<JobCiplSourceKind, string> = {
  CIPL: 'CIPL gabungan',
  COMMERCIAL_INVOICE: 'Commercial invoice',
  PACKING_LIST: 'Packing list',
}

export function JobCiplStatusCard({ job, onScan }: { job: Job; onScan: () => void }) {
  const summary = deriveCiplStatus(job)
  const invoiceNumber = job.commercialInvoiceNumber || job.ciplDocument?.nomor || null
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <CalendarDays size={20} className="text-orange-600" aria-hidden="true" />
        CIPL
      </h2>
      <p className="mt-4 text-sm font-medium text-slate-800">{ciplStatusText(summary)}</p>
      {job.ciplSources.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {job.ciplSources.map((source, index) => (
            <li key={`${source.kind}-${source.receivedAt}-${index}`}>
              {ciplSourceLabels[source.kind]} · {fmtDate(source.receivedAt)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Belum ada berkas CIPL.</p>
      )}
      <p className="mt-3 text-sm text-slate-600">No. Invoice: {invoiceNumber || '—'}</p>
      <button type="button" className="btn-secondary mt-4" onClick={onScan}>
        Tambah / scan dokumen
      </button>
    </section>
  )
}
