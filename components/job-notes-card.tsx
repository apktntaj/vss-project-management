'use client'

import { useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Pencil, Plus } from 'lucide-react'

import { saveJobOperationalDetails, type Job } from '@/lib/data-client'
import { GuardedButton } from '@/components/guarded-button'
import { notify } from '@/lib/notify'
import type { Denial } from '@/lib/write-access'

type TextField = 'notes' | 'specialInstructions'

type FieldCopy = {
  title: string
  placeholder: string
  maxLength: number
  empty: string
  add: string
  saved: string
  failed: string
  /** Isi tampil menonjol sebagai peringatan (permukaan amber). */
  warning: boolean
}

const COPY: Record<TextField, FieldCopy> = {
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
}

/** Isi lebih panjang dari ini (karakter) atau lebih dari 3 baris dipotong dengan tombol "Selengkapnya". */
const CLAMP_CHARS = 180

/**
 * Satu field teks job, diedit di tempat. Kosong: hanya ajakan kecil "Tambah …" agar tidak
 * berisik; terisi: tampil (dipotong bila panjang, ada "Selengkapnya"), tombol pensil membuka kotak
 * edit berisi teks utuh. Special instructions yang terisi tampil menonjol (amber + ikon).
 */
function JobTextField({
  job,
  field,
  onSaved,
  denial,
}: {
  job: Job
  field: TextField
  onSaved: (job: Job) => void
  denial: Denial
}) {
  const copy = COPY[field]
  const value = job[field]
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  // Job batal tidak dapat diubah lagi: isi hanya dibaca.
  const readOnly = job.status === 'CANCELLED'
  const highlighted = copy.warning && Boolean(value) && !editing
  const long = Boolean(value) && (value!.length > CLAMP_CHARS || value!.split('\n').length > 3)
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

  if (editing) {
    return (
      <div className="space-y-2">
        <label htmlFor={`job-${field}`} className="text-sm font-semibold">
          {copy.title}
        </label>
        <textarea
          id={`job-${field}`}
          autoFocus
          rows={4}
          maxLength={copy.maxLength}
          value={draft}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={copy.placeholder}
          aria-describedby={`job-${field}-count`}
          className="input min-h-24 w-full"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={`job-${field}-count`} className="text-xs text-slate-600">
            {draft.length}/{copy.maxLength} · Ctrl+Enter untuk menyimpan, Esc untuk membatalkan
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => setEditing(false)}>
              Batal
            </button>
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!value) {
    return readOnly ? (
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-foreground">{copy.title}:</span> {copy.empty}
      </p>
    ) : (
      <GuardedButton
        denial={denial}
        onClick={startEditing}
        className="inline-flex min-h-8 w-fit items-center gap-1 rounded-md text-sm text-slate-600 hover:text-slate-900"
      >
        <Plus size={14} aria-hidden="true" /> {copy.add}
      </GuardedButton>
    )
  }

  return (
    <div
      className={
        highlighted ? 'rounded-xl border border-amber-300 bg-amber-50 p-3' : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={`flex items-center gap-1.5 text-sm font-semibold ${highlighted ? 'text-amber-900' : ''}`}
        >
          {highlighted && <AlertTriangle size={15} aria-hidden="true" />}
          {copy.title}
        </p>
        {!readOnly ? (
          <GuardedButton
            denial={denial}
            onClick={startEditing}
            aria-label={`Ubah ${copy.title.toLowerCase()}`}
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-black/5 hover:text-slate-900"
          >
            <Pencil size={14} aria-hidden="true" />
          </GuardedButton>
        ) : null}
      </div>
      <p
        className={`mt-1 text-sm whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'} ${
          highlighted ? 'font-medium text-slate-900' : 'text-slate-700'
        }`}
      >
        {value}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="mt-1 min-h-8 rounded text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900"
        >
          {expanded ? 'Ringkas' : 'Selengkapnya'}
        </button>
      ) : null}
    </div>
  )
}

/**
 * Satu kartu catatan job: special instructions (permintaan klien, menonjol bila terisi) lalu
 * catatan operasional. Saat keduanya kosong kartu tetap ringkas (dua ajakan "Tambah …").
 */
export function JobNotesPanel({
  job,
  onSaved,
  denial,
}: {
  job: Job
  onSaved: (job: Job) => void
  denial: Denial
}) {
  return (
    <section className="card space-y-3 p-5" aria-labelledby="job-notes-heading">
      <h2 id="job-notes-heading" className="text-sm font-semibold">
        Catatan job
      </h2>
      <JobTextField job={job} field="specialInstructions" onSaved={onSaved} denial={denial} />
      <JobTextField job={job} field="notes" onSaved={onSaved} denial={denial} />
    </section>
  )
}
