'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Save, Sparkles } from 'lucide-react'
import {
  getNextManifestSeq,
  saveJobOperationalDetails,
  type Job,
  type JobDetailsInput,
} from '@/lib/data-client'
import {
  jobStatuses,
  transportModeLabels,
  transportModes,
  type JobStatus,
  type TransportMode,
} from '@/domain/job/types'
import { formatJobNumber, formatManifestSequence } from '@/domain/job/numbering'

// Editor header job di halaman detail. Simpan selalu patch SEMPIT lewat `saveJobOperationalDetails`
// lalu mengangkat job terbaru ke pemanggil (`onSaved` → `setJob`).

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

const jobStatusLabels: Record<JobStatus, string> = {
  DRAFT: 'Draf',
  IN_PROGRESS: 'Sedang diproses',
  ON_HOLD: 'Ditunda',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
}

/** Patch + simpan + angkat job baru; menutup editor saat sukses. */
function useJobSave(job: Job, onSaved: (job: Job) => void, close: () => void) {
  const [saving, setSaving] = useState(false)
  async function save(patch: JobDetailsInput) {
    setSaving(true)
    try {
      const next = await saveJobOperationalDetails(job, patch)
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
