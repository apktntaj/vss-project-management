'use client'

import { useState, type KeyboardEvent } from 'react'
import { Pencil, Plus } from 'lucide-react'

import { saveJobOperationalDetails, type Job } from '@/lib/data-client'

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

/**
 * Catatan job (`job.notes`), diedit di tempat. Kosong: hanya ajakan kecil "Tambah catatan" agar
 * tidak berisik; terisi: tampil dipotong tiga baris, klik untuk membuka kotak edit berisi teks utuh.
 */
export function JobNotesCard({ job, onSaved }: { job: Job; onSaved: (job: Job) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  // Job batal tidak dapat diubah lagi: catatan hanya dibaca.
  const readOnly = job.status === 'CANCELLED'
  function startEditing() {
    setDraft(job.notes ?? '')
    setEditing(true)
  }

  async function save() {
    const next = draft.trim() || null
    if (next === (job.notes ?? null)) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const saved = await saveJobOperationalDetails(job, { notes: next })
      onSaved(saved)
      notify('Catatan job disimpan.', 'success')
      setEditing(false)
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Catatan tidak dapat disimpan.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') setEditing(false)
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void save()
  }

  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Catatan</p>
        {job.notes && !editing && !readOnly ? (
          <button
            type="button"
            onClick={startEditing}
            aria-label="Ubah catatan"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
            maxLength={5000}
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Catatan job"
            placeholder="Catatan operasional job"
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
          {job.notes ?? <span className="text-slate-400">Tidak ada catatan.</span>}
        </p>
      ) : job.notes ? (
        <button
          type="button"
          onClick={startEditing}
          title="Klik untuk mengubah catatan"
          className="mt-2 line-clamp-3 text-left text-sm whitespace-pre-wrap text-slate-600"
        >
          {job.notes}
        </button>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="mt-2 inline-flex w-fit items-center gap-1 text-sm text-slate-400 hover:text-slate-700"
        >
          <Plus size={14} aria-hidden="true" /> Tambah catatan
        </button>
      )}
    </section>
  )
}
