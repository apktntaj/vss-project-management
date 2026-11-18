'use client'

import { useState, type KeyboardEvent } from 'react'
import { Pencil, Plus } from 'lucide-react'

import { saveJobOperationalDetails, type Job } from '@/lib/data-client'

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

type TextField = 'notes' | 'specialInstructions'

type FieldCopy = {
  title: string
  placeholder: string
  maxLength: number
  empty: string
  add: string
  saved: string
  failed: string
  /** Isi tampil sebagai peringatan (permukaan amber). */
  warning: boolean
}

const COPY: Record<TextField, FieldCopy> = {
  notes: {
    title: 'Catatan',
    placeholder: 'Catatan operasional job',
    maxLength: 5000,
    empty: 'Tidak ada catatan.',
    add: 'Tambah catatan',
    saved: 'Catatan job disimpan.',
    failed: 'Catatan tidak dapat disimpan.',
    warning: false,
  },
  specialInstructions: {
    title: 'Special instructions',
    placeholder: 'Permintaan khusus klien, mis. butuh vacuum pack, urgent re-export',
    maxLength: 1000,
    empty: 'Tidak ada special instruction.',
    add: 'Tambah special instruction',
    saved: 'Special instruction disimpan.',
    failed: 'Special instruction tidak dapat disimpan.',
    warning: true,
  },
}

/**
 * Satu field teks job, diedit di tempat. Kosong: hanya ajakan kecil "Tambah …" agar tidak
 * berisik; terisi: tampil dipotong tiga baris, klik untuk membuka kotak edit berisi teks utuh.
 */
function JobTextFieldCard({
  job,
  field,
  onSaved,
}: {
  job: Job
  field: TextField
  onSaved: (job: Job) => void
}) {
  const copy = COPY[field]
  const value = job[field]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  // Job batal tidak dapat diubah lagi: isi hanya dibaca.
  const readOnly = job.status === 'CANCELLED'
  const highlighted = copy.warning && Boolean(value) && !editing
  function startEditing() {
    setDraft(value ?? '')
    setEditing(true)
  }

  async function save() {
    const next = draft.trim() || null
    if (next === (value ?? null)) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const saved = await saveJobOperationalDetails(job, { [field]: next })
      onSaved(saved)
      notify(copy.saved, 'success')
      setEditing(false)
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : copy.failed, 'error')
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') setEditing(false)
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void save()
  }

  return (
    <section className={`card flex flex-col p-5 ${highlighted ? 'border-amber-300 bg-amber-50' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{copy.title}</p>
        {value && !editing && !readOnly ? (
          <button
            type="button"
            onClick={startEditing}
            aria-label={`Ubah ${copy.title.toLowerCase()}`}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-1 flex-col gap-3">
          <textarea
            autoFocus
            rows={4}
            maxLength={copy.maxLength}
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label={copy.title}
            placeholder={copy.placeholder}
            className="input min-h-24 w-full"
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => setEditing(false)}>
              Batal
            </button>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      ) : readOnly ? (
        <p className="mt-2 text-sm whitespace-pre-wrap text-slate-600">
          {value ?? <span className="text-slate-500">{copy.empty}</span>}
        </p>
      ) : value ? (
        <button
          type="button"
          onClick={startEditing}
          title={`Klik untuk mengubah ${copy.title.toLowerCase()}`}
          className={`mt-2 line-clamp-3 text-left text-sm whitespace-pre-wrap ${highlighted ? 'font-medium text-slate-800' : 'text-slate-600'}`}
        >
          {value}
        </button>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="mt-2 inline-flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <Plus size={14} aria-hidden="true" /> {copy.add}
        </button>
      )}
    </section>
  )
}

/** Catatan job (`job.notes`). */
export function JobNotesCard(props: { job: Job; onSaved: (job: Job) => void }) {
  return <JobTextFieldCard {...props} field="notes" />
}

/** Special instruction job (`job.specialInstructions`): permintaan khusus klien, tampil sebagai peringatan. */
export function JobSpecialInstructionsCard(props: { job: Job; onSaved: (job: Job) => void }) {
  return <JobTextFieldCard {...props} field="specialInstructions" />
}
